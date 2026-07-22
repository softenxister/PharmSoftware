import { Prisma } from "@/generated/prisma/client";
import type { SalesProduct, StockItemInput } from "./types";
import type { StockReadQuery } from "./stockReadQuery";
import { prisma } from "./prisma";
import {
  createSavedStockItem,
  normalizeBarcodeValues,
  relatedLineUpdates,
  savedStockToSalesProduct,
} from "./stockItemMapper";
import type { PharmUser } from "@/server/auth/pharmUser";
import {
  hasForbiddenStockDiscountChange,
  type StockItemDetailPatch,
} from "./stockItemDetail";

export type PurchasedStockLineInput = {
  productId: string;
  barcode: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  unitMultiplier: number;
  freeQuantity: number;
  freeUnitMultiplier: number;
  cost: number;
};

export type SoldStockLineInput = {
  productId: string;
  batchNo: string;
  quantity: number;
  unitMultiplier: number;
};

const productGraph = {
  category: true,
  manufacturer: true,
  barcodeAliases: true,
  parentPacks: {
    include: { barcodeAliases: true },
    orderBy: [
      { packUnit: "asc" as const },
      { childPackUnit: "asc" as const },
      { childPackQuantity: "asc" as const },
    ],
  },
  batches: { orderBy: [{ expiryDate: "asc" as const }, { batchNo: "asc" as const }] },
  activeIngredients: {
    orderBy: { ingredient: { canonicalName: "asc" as const } },
    include: { ingredient: true },
  },
};

type StockProductRow = Prisma.ProductGetPayload<{ include: typeof productGraph }>;

function productRowToSalesProduct(
  product: StockProductRow,
  batchCosts: ReadonlyMap<string, number> = new Map(),
): SalesProduct {
  return {
    id: product.id,
    ...(product.externalProductCode ? { externalProductCode: product.externalProductCode } : {}),
    itemName: product.itemName,
    brandName: product.brandName,
    manufacturerName: product.manufacturer.name,
    pack: {
      packUnit: product.packUnit,
      childUnit: product.childUnit,
      childQuantity: Number(product.childQuantity),
      label: product.packLabel,
    },
    parentPacks: product.parentPacks.map((pack) => ({
      id: pack.id,
      packUnit: pack.packUnit,
      childPackUnit: pack.childPackUnit,
      childPackQuantity: Number(pack.childPackQuantity),
      label: pack.label,
      priceMultiplier: Number(pack.priceMultiplier),
      ...(pack.sellPriceThb === null ? {} : { sellPriceThb: Number(pack.sellPriceThb) }),
      barcodes: [
        ...(pack.barcode ? [pack.barcode] : []),
        ...pack.barcodeAliases.map((alias) => alias.barcode),
      ],
    })),
    location: product.location,
    minimumStock: product.minimumStock,
    maximumStock: product.maximumStock,
    discountPercent: product.discountPercent,
    isDiscountLocked: product.isDiscountLocked,
    isReturnable: product.isReturnable,
    defaultDosage: [
      product.defaultDoseMorning,
      product.defaultDoseNoon,
      product.defaultDoseEvening,
      product.defaultDoseNight,
    ],
    tagName: product.tagName,
    barcode: product.barcode,
    barcodes: product.barcodeAliases
      .filter((alias) => alias.parentPackId === null)
      .map((alias) => alias.barcode),
    category: product.category.name,
    imageUrl: product.imageUrl,
    weeklySold: product.weeklySold,
    compositionStatus: product.compositionStatus.toLowerCase() as SalesProduct["compositionStatus"],
    activeIngredients: product.activeIngredients.map(({ ingredient, strength, sourceName, sourceUrl }) => ({
      id: ingredient.id,
      canonicalName: ingredient.canonicalName,
      ...(ingredient.thaiName ? { thaiName: ingredient.thaiName } : {}),
      ...(strength ? { strength } : {}),
      sourceName,
      sourceUrl,
    })),
    batches: product.batches.map((batch) => ({
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      sellPriceThb: Number(batch.sellPriceThb),
      costThb: batchCosts.get(`${product.id}::${batch.batchNo}`),
      availableStock: Number(batch.availableStock),
    })),
  };
}

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

async function upsertStockItem(tx: Prisma.TransactionClient, input: StockItemInput): Promise<string> {
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
  const [category, manufacturer] = await Promise.all([
    tx.category.upsert({
      where: { name: mapped.category || "Uncategorized" },
      update: {},
      create: { name: mapped.category || "Uncategorized" },
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
    await tx.productBatch.upsert({
      where: { productId_batchNo: { productId: mapped.id, batchNo: batch.batchNo } },
      update: { expiryDate: batch.expiryDate, sellPriceThb: batch.sellPriceThb },
      create: {
        productId: mapped.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        sellPriceThb: batch.sellPriceThb,
        availableStock: batch.availableStock,
      },
    });
  }
  return mapped.id;
}

export type StockProductPage = {
  products: SalesProduct[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

function stockProductWhere(input: StockReadQuery): Prisma.ProductWhereInput {
  if (input.productIds.length > 0) {
    return { isActive: true, id: { in: input.productIds } };
  }
  if (!input.query) return { isActive: true };

  const text = { contains: input.query, mode: "insensitive" as const };
  return {
    isActive: true,
    OR: [
      { itemName: text },
      { brandName: text },
      { barcode: text },
      { externalProductCode: text },
      { manufacturer: { is: { name: text } } },
      { barcodeAliases: { some: { barcode: text } } },
      {
        parentPacks: {
          some: {
            OR: [
              { barcode: text },
              { barcodeAliases: { some: { barcode: text } } },
            ],
          },
        },
      },
    ],
  };
}

async function readBatchCosts(productIds: string[]): Promise<ReadonlyMap<string, number>> {
  if (productIds.length === 0) return new Map();
  const purchaseLines = await prisma.$queryRaw<Array<{ productId: string; batchNo: string; cost: unknown }>>(Prisma.sql`
    SELECT DISTINCT ON (line."productId", line."batchNo")
      line."productId",
      line."batchNo",
      line."cost"
    FROM "PurchaseLine" line
    INNER JOIN "PurchaseBill" bill ON bill."id" = line."purchaseBillId"
    WHERE line."productId" IN (${Prisma.join(productIds)})
    ORDER BY line."productId", line."batchNo", bill."purchasedAt" DESC, bill."createdAt" DESC
  `);
  const batchCosts = new Map<string, number>();
  for (const line of purchaseLines) {
    batchCosts.set(`${line.productId}::${line.batchNo}`, Number(line.cost));
  }
  return batchCosts;
}

async function rowsToSalesProducts(products: StockProductRow[]): Promise<SalesProduct[]> {
  const batchCosts = await readBatchCosts(products.map((product) => product.id));
  return products.map((product) => productRowToSalesProduct(product, batchCosts));
}

export async function readStockProduct(productId: string): Promise<SalesProduct | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    include: productGraph,
  });
  if (!product) return null;
  return (await rowsToSalesProducts([product]))[0] ?? null;
}

export async function readStockProducts(input: StockReadQuery): Promise<StockProductPage> {
  const where = stockProductWhere(input);
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = input.sort === "weekly"
    ? [{ weeklySold: "desc" }, { itemName: "asc" }, { id: "asc" }]
    : [{ itemName: "asc" }, { id: "asc" }];
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productGraph,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
  ]);

  return {
    products: await rowsToSalesProducts(products),
    page: input.page,
    pageSize: input.pageSize,
    total,
    hasMore: input.page * input.pageSize < total,
  };
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
    const category = await tx.category.upsert({
      where: { name: input.category },
      update: {},
      create: { name: input.category },
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

export async function receivePurchasedStock(
  tx: Prisma.TransactionClient,
  lines: PurchasedStockLineInput[],
): Promise<void> {
  for (const line of lines) {
    const product = await tx.product.findFirst({
      where: {
        OR: [
          { id: line.productId.trim() },
          { barcode: line.barcode.trim() },
        ],
      },
      include: { batches: { orderBy: { expiryDate: "asc" }, take: 1 } },
    });
    if (!product) throw new Error("Purchase item was not found in stock.");

    const purchasedQty = Number(line.quantity) * Number(line.unitMultiplier);
    const freeQty = Number(line.freeQuantity) * Number(line.freeUnitMultiplier);
    const stockQty = purchasedQty + freeQty;
    if (!Number.isFinite(stockQty) || stockQty <= 0) {
      throw new Error(`Purchase quantity is invalid for ${product.itemName}.`);
    }

    const fallbackBatch = product.batches[0];
    const batchNo = line.batchNo.trim()
      || fallbackBatch?.batchNo
      || `PUR-${new Date().toISOString().slice(0, 10)}`;
    await tx.productBatch.upsert({
      where: { productId_batchNo: { productId: product.id, batchNo } },
      update: {
        expiryDate: line.expiryDate.trim() || fallbackBatch?.expiryDate || "",
        availableStock: { increment: stockQty },
      },
      create: {
        productId: product.id,
        batchNo,
        expiryDate: line.expiryDate.trim() || fallbackBatch?.expiryDate || "",
        sellPriceThb: Number(fallbackBatch?.sellPriceThb ?? line.cost) || 0,
        availableStock: stockQty,
      },
    });
  }
}

export async function dispenseSoldStock(
  tx: Prisma.TransactionClient,
  lines: SoldStockLineInput[],
): Promise<void> {
  for (const line of lines) {
    const product = await tx.product.findUnique({ where: { id: line.productId.trim() } });
    if (!product) throw new Error("Sale item was not found in stock.");

    const soldQty = Number(line.quantity) * Number(line.unitMultiplier);
    if (!Number.isFinite(soldQty) || soldQty <= 0) {
      throw new Error("Sale item quantity is invalid.");
    }

    const result = await tx.productBatch.updateMany({
      where: {
        productId: product.id,
        batchNo: line.batchNo.trim(),
        availableStock: { gte: soldQty },
      },
      data: { availableStock: { decrement: soldQty } },
    });

    if (result.count === 0) {
      const batch = await tx.productBatch.findUnique({
        where: { productId_batchNo: { productId: product.id, batchNo: line.batchNo.trim() } },
      });
      if (!batch) throw new Error(`Batch ${line.batchNo} was not found in stock.`);
      throw new Error(`Insufficient stock for ${product.itemName}.`);
    }
  }
}
