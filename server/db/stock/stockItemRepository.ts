import { Prisma } from "@server/generated/prisma/client";
import type { SalesProduct, StockItemInput } from "../types";
import { prisma } from "../prisma";
import {
  createSavedStockItem,
  normalizeBarcodeValues,
  relatedLineUpdates,
  savedStockToSalesProduct,
} from "../stockItemMapper";
import type { PharmUser } from "@server/auth/pharmUser";
import {
  hasForbiddenStockDiscountChange,
  type StockItemDetailPatch,
} from "../stockItemDetail";
import { shouldDiscardStoredProductImage } from "../stockImageUpdate";
import { normalizeProductCategory } from "@server/import/productCategoryNormalization";
import { normalizeOptionalBatchNo } from "@/lib/batchPresentation";
import { normalizeExpiryDate } from "@/lib/expiryDate";
import { readStockProduct } from "./stockCatalogRepository";

async function assertBarcodesAvailable(
  tx: Prisma.TransactionClient,
  productId: string,
  barcodes: string[],
) {
  if (barcodes.length !== new Set(barcodes).size) {
    throw new Error("Each barcode can only be assigned to one unit of an item.");
  }
  if (barcodes.length === 0) return;

  const [productConflict, packConflict, aliasConflict] = await Promise.all([
    tx.product.findFirst({
      where: { barcode: { in: barcodes }, id: { not: productId } },
      select: { barcode: true },
    }),
    tx.productParentPack.findFirst({
      where: { barcode: { in: barcodes }, productId: { not: productId } },
      select: { barcode: true },
    }),
    tx.productBarcodeAlias.findFirst({
      where: { barcode: { in: barcodes }, productId: { not: productId } },
      select: { barcode: true },
    }),
  ]);
  const conflict = productConflict?.barcode ?? packConflict?.barcode ?? aliasConflict?.barcode;
  if (conflict) throw new Error(`Barcode ${conflict} is already assigned to another item.`);
}

async function upsertStockItem(
  tx: Prisma.TransactionClient,
  input: StockItemInput,
): Promise<string> {
  const savedItem = createSavedStockItem(input);
  const barcode = savedItem.barcode;
  const itemName = input.itemName.trim();
  if (!barcode || !itemName) throw new Error("Barcode and item name are required.");

  const current = input.productId?.trim()
    ? await tx.product.findUnique({ where: { id: input.productId.trim() } })
    : await tx.product.findUnique({ where: { barcode } });
  const mapped = savedStockToSalesProduct({
    ...savedItem,
    id: current?.id ?? savedItem.id,
  });
  const requestedBarcodes = [
    mapped.barcode,
    ...(mapped.barcodes ?? []),
    ...mapped.parentPacks.flatMap((pack) => pack.barcodes ?? []),
  ];
  await assertBarcodesAvailable(tx, mapped.id, requestedBarcodes);
  const categoryName = normalizeProductCategory({
    itemName: mapped.itemName,
    brandName: mapped.brandName,
    sourceCategory: mapped.category,
  });
  const [category, manufacturer] = await Promise.all([
    tx.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    }),
    tx.manufacturer.upsert({
      where: { name: mapped.manufacturerName || "Unknown manufacturer" },
      update: {},
      create: { name: mapped.manufacturerName || "Unknown manufacturer" },
    }),
  ]);
  const compositionIdentityChanged = Boolean(current) && (
    current.barcode !== mapped.barcode
    || current.itemName !== mapped.itemName
    || current.brandName !== mapped.brandName
    || current.manufacturerId !== manufacturer.id
  );
  if (shouldDiscardStoredProductImage({
    productIdentityChanged: compositionIdentityChanged,
  })) {
    await tx.productImageAsset.deleteMany({ where: { productId: mapped.id } });
  }

  await tx.product.upsert({
    where: { id: mapped.id },
    update: {
      isActive: true,
      barcode: mapped.barcode,
      itemName: mapped.itemName,
      brandName: mapped.brandName,
      manufacturerId: manufacturer.id,
      categoryId: category.id,
      packUnit: mapped.pack.packUnit,
      childUnit: mapped.pack.childUnit,
      childQuantity: mapped.pack.childQuantity,
      packLabel: mapped.pack.label,
      location: mapped.location,
      imageUrl: mapped.imageUrl,
      ...(compositionIdentityChanged ? {
        compositionStatus: "PENDING",
        compositionCheckedAt: null,
        compositionRetryAt: null,
        compositionError: null,
      } : {}),
    },
    create: {
      id: mapped.id,
      barcode: mapped.barcode,
      itemName: mapped.itemName,
      brandName: mapped.brandName,
      manufacturerId: manufacturer.id,
      categoryId: category.id,
      packUnit: mapped.pack.packUnit,
      childUnit: mapped.pack.childUnit,
      childQuantity: mapped.pack.childQuantity,
      packLabel: mapped.pack.label,
      location: mapped.location,
      imageUrl: mapped.imageUrl,
      weeklySold: mapped.weeklySold,
    },
  });

  if (compositionIdentityChanged) {
    await tx.productIngredient.deleteMany({ where: { productId: mapped.id } });
  }

  const lineUpdates = relatedLineUpdates(mapped);
  await Promise.all([
    tx.purchaseLine.updateMany(lineUpdates.purchaseLines),
    tx.saleLine.updateMany(lineUpdates.saleLines),
  ]);

  await tx.productBarcodeAlias.deleteMany({ where: { productId: mapped.id } });
  await tx.productParentPack.deleteMany({ where: { productId: mapped.id } });

  const baseAliases = normalizeBarcodeValues("", mapped.barcodes);
  if (baseAliases.length > 0) {
    await tx.productBarcodeAlias.createMany({
      data: baseAliases.map((alias) => ({ productId: mapped.id, barcode: alias })),
    });
  }

  for (const pack of mapped.parentPacks) {
    const packBarcodes = normalizeBarcodeValues("", pack.barcodes);
    const parentPack = await tx.productParentPack.create({
      data: {
        productId: mapped.id,
        packUnit: pack.packUnit,
        childPackUnit: pack.childPackUnit,
        childPackQuantity: pack.childPackQuantity,
        label: pack.label,
        priceMultiplier: pack.priceMultiplier,
        sellPriceThb: pack.sellPriceThb ?? null,
        barcode: packBarcodes[0] ?? null,
      },
    });
    if (packBarcodes.length > 1) {
      await tx.productBarcodeAlias.createMany({
        data: packBarcodes.slice(1).map((alias) => ({
          productId: mapped.id,
          parentPackId: parentPack.id,
          barcode: alias,
        })),
      });
    }
  }

  const batch = mapped.batches[0];
  if (batch) {
    const batchNo = normalizeOptionalBatchNo(batch.batchNo);
    const expiryDate = normalizeExpiryDate(batch.expiryDate);
    const exactBatch = await tx.productBatch.findFirst({
      where: {
        productId: mapped.id,
        batchNo,
        expiryDate,
      },
      select: { id: true },
    });
    if (exactBatch) {
      await tx.productBatch.update({
        where: { id: exactBatch.id },
        data: { sellPriceThb: batch.sellPriceThb },
      });
    } else {
      const sameLotBatches = await tx.productBatch.findMany({
        where: { productId: mapped.id, batchNo },
        select: { id: true },
        take: 2,
      });
      if (batchNo !== null && sameLotBatches.length === 1) {
        await tx.productBatch.update({
          where: { id: sameLotBatches[0].id },
          data: { expiryDate, sellPriceThb: batch.sellPriceThb },
        });
      } else {
        await tx.productBatch.create({
          data: {
            productId: mapped.id,
            batchNo,
            expiryDate,
            sellPriceThb: batch.sellPriceThb,
            availableStock: batch.availableStock,
          },
        });
      }
    }
  }
  return mapped.id;
}

export async function updateStockProductPhotoUrl(
  productId: string,
  photoUrl: string,
): Promise<{ productId: string; imageUrl: string } | null> {
  const updated = await prisma.product.updateMany({
    where: { id: productId, isActive: true },
    data: { imageUrl: photoUrl },
  });
  return updated.count === 1 ? { productId, imageUrl: photoUrl } : null;
}

export async function saveStockItem(input: StockItemInput): Promise<SalesProduct> {
  const productId = await prisma.$transaction((tx) => upsertStockItem(tx, input));
  const product = await readStockProduct(productId);
  if (!product) throw new Error("Saved stock item could not be reloaded.");
  return product;
}

export async function saveStockItems(inputs: StockItemInput[]): Promise<number> {
  await prisma.$transaction(async (tx) => {
    for (const input of inputs) await upsertStockItem(tx, input);
  });
  return inputs.length;
}

export async function updateStockItemDetail(
  input: StockItemDetailPatch,
  user: Pick<PharmUser, "role">,
): Promise<SalesProduct | null> {
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id: input.productId } });
    if (!current || !current.isActive) return false;
    if (hasForbiddenStockDiscountChange(user.role, current, input)) {
      throw new Error("Stock discount permission denied.");
    }
    const categoryName = normalizeProductCategory({
      itemName: current.itemName,
      brandName: current.brandName,
      sourceCategory: input.category,
    });
    const category = await tx.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });
    await tx.product.update({
      where: { id: current.id },
      data: {
        location: input.location,
        categoryId: category.id,
        minimumStock: input.minimumStock,
        maximumStock: input.maximumStock,
        isReturnable: input.isReturnable,
        defaultDoseMorning: input.defaultDosage[0],
        defaultDoseNoon: input.defaultDosage[1],
        defaultDoseEvening: input.defaultDosage[2],
        defaultDoseNight: input.defaultDosage[3],
        tagName: input.tagName,
        ...(user.role === "owner" ? {
          discountPercent: input.discountPercent,
          isDiscountLocked: input.isDiscountLocked,
        } : {}),
      },
    });
    return true;
  });
  return updated ? readStockProduct(input.productId) : null;
}

export async function deleteStockItem(productId: string): Promise<string | null> {
  const result = await prisma.product.updateMany({
    where: { id: productId, isActive: true },
    data: { isActive: false },
  });
  return result.count === 0 ? null : productId;
}
