import { randomUUID } from "node:crypto";
import { Prisma } from "@server/generated/prisma/client";
import type { SalesProduct } from "../types";
import {
  PRODUCT_PACKAGE_VALUES,
  PRODUCT_SUBUNIT_VALUES,
  PRODUCT_UNIT_VALUES,
  canonicalizeProductUnit,
} from "@/i18n/productUnits";
import { normalizeExpiryDate } from "@/lib/expiryDate";
import {
  isPlaceholderProductImageUrl,
  productImageUrl,
} from "@server/product-images/placeholder";
import { parseManualProductImageUrl } from "@server/product-images/secureFetch";
import { normalizeProductCategory } from "@server/import/productCategoryNormalization";
import { normalizeOptionalBatchNo } from "@/lib/batchPresentation";
import { prisma } from "../core/prisma";
import { readStockProduct } from "./stockCatalogRepository";
import { shouldDiscardStoredProductImage } from "./stockImageUpdate";
import { normalizeBarcodeValues, relatedLineUpdates } from "./stockItemMapper";
import {
  inferProductDosageForm,
  isStoredDosageForm,
  resolveDosageFormSelection,
  type DosageFormSource,
  type StoredDosageForm,
} from "@/lib/productDosageForm";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_PRODUCT_WRITE_ITEMS = 100;
const MAX_PACKAGING_ROWS = 50;
const MAX_BARCODES_PER_LEVEL = 20;
const MAX_SELL_PRICE_THB = 999_999_999_999.99;
const MAX_PACK_QUANTITY = 99_999_999_999.999;

export type ProductWriteCommand = {
  productId?: string;
  photoUrl: string;
  barcodes: string[];
  itemName: string;
  lotNo: string;
  expiryDate: string;
  location: string;
  manufacturer: string;
  sellPriceThb: number;
  category: string | null;
  childQuantity: number;
  childUnit: string;
  packUnit: string;
  brandName: string;
  dosageForm?: StoredDosageForm | null;
  packaging: Array<{
    packUnit: string;
    childQuantity: number;
    childUnit: string;
    barcodes: string[];
    sellPriceThb?: number;
  }>;
};

export type ProductWriteRequest = {
  mode: "single" | "bulk";
  items: ProductWriteCommand[];
};

type ProductWriteIdentity = {
  id: string;
  barcode: string;
  aliases: string[];
};

function cleanText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length <= maximum && !CONTROL_CHARACTERS.test(text) ? text : null;
}

function positiveDecimal(value: string, maximum: number, scale: number): number | null {
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value)) return null;
  const fraction = (value.split(".")[1] ?? "").replace(/0+$/, "");
  if (fraction.length > scale) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= maximum ? number : null;
}

function cleanBarcodes(primary: unknown, aliases: unknown): string[] | null {
  if (typeof primary !== "string") return null;
  if (aliases !== undefined && (!Array.isArray(aliases) || aliases.some((value) => typeof value !== "string"))) {
    return null;
  }
  const suppliedBarcodes = [primary, ...((aliases as string[] | undefined) ?? [])]
    .flatMap((value) => value.split(/[;,]/))
    .map((value) => value.trim())
    .filter(Boolean);
  if (new Set(suppliedBarcodes).size !== suppliedBarcodes.length) return null;
  const barcodes = normalizeBarcodeValues(primary, aliases as string[] | undefined);
  if (
    barcodes.length > MAX_BARCODES_PER_LEVEL
    || barcodes.some((barcode) => barcode.length > 128 || CONTROL_CHARACTERS.test(barcode))
  ) return null;
  return barcodes;
}

function cleanPhotoUrl(value: unknown, productId?: string): string | null {
  const photoUrl = cleanText(value, 2_048);
  if (photoUrl === null) return null;
  if (!photoUrl) return "";
  if (productId) {
    const managedUrl = productImageUrl(productId);
    if (photoUrl === managedUrl) return photoUrl;
    if (photoUrl.startsWith(`${managedUrl}?`) && !photoUrl.includes("#")) {
      const query = new URLSearchParams(photoUrl.slice(managedUrl.length + 1));
      const version = query.get("v") ?? "";
      if ([...query.keys()].length === 1 && version.length > 0 && version.length <= 256) {
        return photoUrl;
      }
    }
  }
  try {
    const source = parseManualProductImageUrl(photoUrl);
    if (!source || isPlaceholderProductImageUrl(source.toString())) return null;
    return source.toString();
  } catch {
    return null;
  }
}

function cleanUnit(value: unknown, allowed: readonly string[]): string | null {
  const text = cleanText(value, 80);
  if (!text) return null;
  const unit = canonicalizeProductUnit(text);
  return allowed.includes(unit) ? unit : null;
}

function parsePackaging(value: unknown): ProductWriteCommand["packaging"] | null {
  if (!Array.isArray(value) || value.length > MAX_PACKAGING_ROWS) return null;
  const packaging: ProductWriteCommand["packaging"] = [];
  const identities = new Set<string>();

  for (const rawRow of value) {
    if (!rawRow || typeof rawRow !== "object") return null;
    const row = rawRow as Record<string, unknown>;
    const quantityText = cleanText(row.childQuantity, 40);
    const sellPriceText = row.sellPrice === undefined ? "" : cleanText(row.sellPrice, 40);
    const barcodes = cleanBarcodes(row.barcode, row.barcodes);
    if (quantityText === null || sellPriceText === null || barcodes === null) return null;

    const isUnused = !quantityText && !sellPriceText && barcodes.length === 0;
    if (isUnused) continue;

    const packUnit = cleanUnit(row.parentUnit, PRODUCT_PACKAGE_VALUES);
    const childUnit = cleanUnit(row.childUnit, PRODUCT_SUBUNIT_VALUES);
    const childQuantity = positiveDecimal(quantityText, MAX_PACK_QUANTITY, 3);
    const sellPriceThb = sellPriceText
      ? positiveDecimal(sellPriceText, MAX_SELL_PRICE_THB, 2)
      : undefined;
    if (!packUnit || !childUnit || childQuantity === null || (sellPriceText && sellPriceThb === null)) {
      return null;
    }

    const identity = `${packUnit}\u0000${childQuantity}`;
    if (identities.has(identity)) return null;
    identities.add(identity);
    packaging.push({
      packUnit,
      childQuantity,
      childUnit,
      barcodes,
      ...(sellPriceThb === undefined ? {} : { sellPriceThb }),
    });
  }

  return packaging;
}

function parseProductWrite(value: unknown): ProductWriteCommand | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const productId = input.productId === undefined ? undefined : cleanText(input.productId, 128);
  const photoUrl = cleanPhotoUrl(input.photoUrl, productId || undefined);
  const barcodes = cleanBarcodes(input.barcode, input.barcodes);
  const itemName = cleanText(input.itemName, 300);
  const lotNo = cleanText(input.lotNo, 128);
  const expiryText = cleanText(input.expiryDate, 40);
  const location = cleanText(input.location, 120);
  const manufacturer = cleanText(input.manufacturer, 200);
  const sellPriceText = cleanText(input.sellPrice, 40);
  const categoryText = cleanText(input.itemCategory, 200);
  const category = categoryText === "" || categoryText?.toLocaleLowerCase("en-US") === "unclassified"
    ? null
    : categoryText;
  const weightageText = cleanText(input.weightage, 40);
  const childUnit = cleanUnit(input.subUnit ?? input.unit, PRODUCT_SUBUNIT_VALUES);
  const packUnit = cleanUnit(input.unit, PRODUCT_UNIT_VALUES);
  const brandName = cleanText(input.brandName, 200);
  const dosageForm = input.dosageForm;
  const packaging = parsePackaging(input.packagingRows);
  if (
    productId === null || photoUrl === null || barcodes === null || !itemName
    || lotNo === null || expiryText === null || location === null || manufacturer === null
    || sellPriceText === null || categoryText === null || weightageText === null
    || !childUnit || !packUnit || brandName === null || packaging === null
    || (!productId && (barcodes.length === 0 || !brandName))
    || (dosageForm !== undefined && dosageForm !== null && !isStoredDosageForm(dosageForm))
  ) return null;

  const sellPriceThb = positiveDecimal(sellPriceText, MAX_SELL_PRICE_THB, 2);
  const childQuantity = positiveDecimal(weightageText, MAX_PACK_QUANTITY, 3);
  if (sellPriceThb === null || childQuantity === null) return null;
  let expiryDate: string;
  try {
    expiryDate = normalizeExpiryDate(expiryText);
  } catch {
    return null;
  }

  const everyBarcode = [
    ...barcodes,
    ...packaging.flatMap((pack) => pack.barcodes),
  ];
  if (new Set(everyBarcode).size !== everyBarcode.length) return null;
  const cleanDosageForm = isStoredDosageForm(dosageForm) && dosageForm !== "Unclassified"
    ? dosageForm
    : null;

  return {
    productId: productId || undefined,
    photoUrl,
    barcodes,
    itemName,
    lotNo,
    expiryDate,
    location,
    manufacturer,
    sellPriceThb,
    category,
    childQuantity,
    childUnit,
    packUnit,
    brandName,
    dosageForm: cleanDosageForm,
    packaging,
  };
}

export function parseProductWriteRequest(value: unknown): ProductWriteRequest | null {
  const isBulk = Boolean(value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).items));
  const rawItems = isBulk ? (value as { items: unknown[] }).items : [value];
  if (rawItems.length === 0 || rawItems.length > MAX_PRODUCT_WRITE_ITEMS) return null;
  const items = rawItems.map(parseProductWrite);
  return items.every((item): item is ProductWriteCommand => item !== null)
    ? { mode: isBulk ? "bulk" : "single", items }
    : null;
}

export function resolveProductWriteIdentity(
  command: Pick<ProductWriteCommand, "barcodes">,
  current: { id: string; barcode: string } | null,
  createUuid: () => string = randomUUID,
): ProductWriteIdentity {
  const uuid = current ? "" : createUuid();
  const requestedBarcode = command.barcodes[0];
  return {
    id: current?.id ?? `p-${uuid}`,
    barcode: requestedBarcode || current?.barcode || `PHARM-${uuid.toUpperCase()}`,
    aliases: requestedBarcode ? command.barcodes.slice(1) : [],
  };
}

type CurrentProductDosage = {
  dosageForm: string | null;
  dosageFormSource: string;
  migrationGenericName: string | null;
};

export function resolveProductWriteDosage(
  command: Pick<ProductWriteCommand, "itemName" | "childUnit" | "childQuantity" | "dosageForm">,
  current: CurrentProductDosage | null,
  category: string | null,
  hasIngredientEvidence: boolean,
): { dosageForm: StoredDosageForm | null; dosageFormSource: DosageFormSource; childUnit: string } {
  const currentDosageForm = current && isStoredDosageForm(current.dosageForm)
    ? current.dosageForm
    : "Unclassified";
  const currentSource = current
    && (current.dosageFormSource === "INFERRED"
      || current.dosageFormSource === "THAI_FDA"
      || current.dosageFormSource === "MANUAL")
    ? current.dosageFormSource
    : "INFERRED";
  const inferred = inferProductDosageForm({
    itemName: command.itemName,
    genericName: current?.migrationGenericName ?? undefined,
    category: category ?? "",
    childUnit: command.childUnit,
    childQuantity: command.childQuantity,
    hasIngredientEvidence,
  });
  const selection = resolveDosageFormSelection({
    requestedDosageForm: command.dosageForm ?? currentDosageForm,
    current: current ? { dosageForm: currentDosageForm, source: currentSource } : null,
    inferred,
  });
  return {
    dosageForm: selection.dosageForm === "Unclassified" ? null : selection.dosageForm,
    dosageFormSource: selection.source,
    childUnit: selection.dosageForm === inferred.dosageForm
      ? (inferred.correctedChildUnit ?? command.childUnit)
      : command.childUnit,
  };
}

async function assertBarcodesAvailable(
  tx: Prisma.TransactionClient,
  productId: string,
  barcodes: string[],
): Promise<void> {
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

async function upsertProductWrite(
  tx: Prisma.TransactionClient,
  command: ProductWriteCommand,
): Promise<string> {
  const requestedBarcode = command.barcodes[0];
  const current = command.productId
    ? await tx.product.findUnique({ where: { id: command.productId } })
    : requestedBarcode
      ? await tx.product.findUnique({ where: { barcode: requestedBarcode } })
      : null;
  if (command.productId && !current) throw new Error("Stock item was not found.");

  const identity = resolveProductWriteIdentity(command, current);
  const requestedBarcodes = [
    identity.barcode,
    ...identity.aliases,
    ...command.packaging.flatMap((pack) => pack.barcodes),
  ];
  await assertBarcodesAvailable(tx, identity.id, requestedBarcodes);

  const brandName = command.brandName || command.manufacturer || command.itemName;
  const manufacturerName = command.manufacturer || brandName;
  const categoryName = command.category
    ? normalizeProductCategory({
      itemName: command.itemName,
      brandName,
      sourceCategory: command.category,
    })
    : null;
  const [category, manufacturer] = await Promise.all([
    categoryName ? tx.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    }) : Promise.resolve(null),
    tx.manufacturer.upsert({
      where: { name: manufacturerName },
      update: {},
      create: { name: manufacturerName },
    }),
  ]);
  const compositionIdentityChanged = Boolean(current) && (
    current.barcode !== identity.barcode
    || current.itemName !== command.itemName
    || current.brandName !== brandName
    || current.manufacturerId !== manufacturer.id
  );
  const hasIngredientEvidence = current && !compositionIdentityChanged
    ? Boolean(await tx.productIngredient.findFirst({
        where: { productId: current.id },
        select: { productId: true },
      }) ?? await tx.productImportedIngredient.findFirst({
        where: { productId: current.id },
        select: { productId: true },
      }))
    : false;
  const dosage = resolveProductWriteDosage(
    command,
    current,
    categoryName,
    hasIngredientEvidence,
  );
  if (shouldDiscardStoredProductImage({ productIdentityChanged: compositionIdentityChanged })) {
    await tx.productImageAsset.deleteMany({ where: { productId: identity.id } });
  }

  const imageUrl = command.photoUrl || productImageUrl(identity.id);
  const location = command.location || "-";
  await tx.product.upsert({
    where: { id: identity.id },
    update: {
      isActive: true,
      barcode: identity.barcode,
      itemName: command.itemName,
      brandName,
      manufacturerId: manufacturer.id,
      categoryId: category?.id ?? null,
      packUnit: command.packUnit,
      childUnit: dosage.childUnit,
      childQuantity: command.childQuantity,
      packLabel: `${command.childQuantity} ${dosage.childUnit}`,
      dosageForm: dosage.dosageForm,
      dosageFormSource: dosage.dosageFormSource,
      location,
      imageUrl,
      ...(compositionIdentityChanged ? {
        compositionStatus: "PENDING" as const,
        compositionCheckedAt: null,
        compositionRetryAt: null,
        compositionError: null,
      } : {}),
    },
    create: {
      id: identity.id,
      barcode: identity.barcode,
      itemName: command.itemName,
      brandName,
      manufacturerId: manufacturer.id,
      categoryId: category?.id ?? null,
      packUnit: command.packUnit,
      childUnit: dosage.childUnit,
      childQuantity: command.childQuantity,
      packLabel: `${command.childQuantity} ${dosage.childUnit}`,
      dosageForm: dosage.dosageForm,
      dosageFormSource: dosage.dosageFormSource,
      location,
      imageUrl,
      weeklySold: 0,
    },
  });

  if (compositionIdentityChanged) {
    await tx.productIngredient.deleteMany({ where: { productId: identity.id } });
  }
  const lineUpdates = relatedLineUpdates({
    id: identity.id,
    barcode: identity.barcode,
    itemName: command.itemName,
    location,
  });
  await Promise.all([
    tx.purchaseLine.updateMany(lineUpdates.purchaseLines),
    tx.saleLine.updateMany(lineUpdates.saleLines),
  ]);

  await tx.productBarcodeAlias.deleteMany({ where: { productId: identity.id } });
  await tx.productParentPack.deleteMany({ where: { productId: identity.id } });
  if (identity.aliases.length > 0) {
    await tx.productBarcodeAlias.createMany({
      data: identity.aliases.map((barcode) => ({ productId: identity.id, barcode })),
    });
  }
  for (const pack of command.packaging) {
    const parentPack = await tx.productParentPack.create({
      data: {
        productId: identity.id,
        packUnit: pack.packUnit,
        childPackUnit: pack.childUnit,
        childPackQuantity: pack.childQuantity,
        label: `1 ${pack.packUnit} = ${pack.childQuantity} ${pack.childUnit}`,
        priceMultiplier: pack.childQuantity,
        sellPriceThb: pack.sellPriceThb ?? null,
        barcode: pack.barcodes[0] ?? null,
      },
    });
    if (pack.barcodes.length > 1) {
      await tx.productBarcodeAlias.createMany({
        data: pack.barcodes.slice(1).map((barcode) => ({
          productId: identity.id,
          parentPackId: parentPack.id,
          barcode,
        })),
      });
    }
  }

  const batchNo = normalizeOptionalBatchNo(
    command.lotNo || `NEW-${identity.barcode.slice(-6) || "000000"}`,
  );
  const exactBatch = await tx.productBatch.findFirst({
    where: { productId: identity.id, batchNo, expiryDate: command.expiryDate },
    select: { id: true },
  });
  if (exactBatch) {
    await tx.productBatch.update({
      where: { id: exactBatch.id },
      data: { sellPriceThb: command.sellPriceThb },
    });
  } else {
    const sameLotBatches = await tx.productBatch.findMany({
      where: { productId: identity.id, batchNo },
      select: { id: true },
      take: 2,
    });
    if (batchNo !== null && sameLotBatches.length === 1) {
      await tx.productBatch.update({
        where: { id: sameLotBatches[0].id },
        data: { expiryDate: command.expiryDate, sellPriceThb: command.sellPriceThb },
      });
    } else {
      await tx.productBatch.create({
        data: {
          productId: identity.id,
          batchNo,
          expiryDate: command.expiryDate,
          sellPriceThb: command.sellPriceThb,
          availableStock: 0,
        },
      });
    }
  }
  return identity.id;
}

export async function persistProductWriteRequest(
  request: ProductWriteRequest,
): Promise<{ mode: "single"; product: SalesProduct } | { mode: "bulk"; savedCount: number }> {
  const productIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const command of request.items) ids.push(await upsertProductWrite(tx, command));
    return ids;
  });
  if (request.mode === "bulk") return { mode: "bulk", savedCount: productIds.length };
  const product = await readStockProduct(productIds[0]);
  if (!product) throw new Error("Saved stock item could not be reloaded.");
  return { mode: "single", product };
}
