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
import { normalizeProductCategory } from "@/server/import/productCategoryNormalization";
import {
  cleanupManualProductImageObjects,
  persistManualProductImageImport,
  prepareManualProductImageImport,
} from "@/server/product-images/manualImport";
import { isPlaceholderProductImageUrl } from "@/server/product-images/placeholder";
import { parseManualProductImageUrl } from "@/server/product-images/secureFetch";

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
  const imageIdentityChanged = Boolean(current) && (
    compositionIdentityChanged
    || current.imageUrl !== mapped.imageUrl
  );

  if (imageIdentityChanged) {
    await tx.productImageAsset.deleteMany({ where: { productId: mapped.id } });
    await tx.productImageCandidate.deleteMany({ where: { productId: mapped.id } });
    await tx.productIdentifier.deleteMany({ where: { productId: mapped.id } });
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
      ...(imageIdentityChanged ? {
        imageResolutionStatus: "PENDING",
        imageCheckedAt: null,
        imageRetryAt: null,
        imageResolutionError: null,
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
  const and: Prisma.ProductWhereInput[] = [];
  if (input.query) {
    const text = { contains: input.query, mode: "insensitive" as const };
    and.push({
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
    });
  }
  if (input.filters.categories.length > 0) {
    and.push({ category: { is: { name: { in: input.filters.categories, mode: "insensitive" } } } });
  }
  if (input.filters.dosageTypes.length > 0) {
    and.push({ childUnit: { in: input.filters.dosageTypes, mode: "insensitive" } });
  }
  if (input.filters.manufacturers.length > 0) {
    and.push({ manufacturer: { is: { name: { in: input.filters.manufacturers, mode: "insensitive" } } } });
  }
  if (input.filters.tags.length > 0) {
    and.push({ tagName: { in: input.filters.tags, mode: "insensitive" } });
  }
  return { isActive: true, ...(and.length > 0 ? { AND: and } : {}) };
}

function requiresAggregateStockRead(input: StockReadQuery): boolean {
  const { filters } = input;
  return input.sort === "stock"
    || input.sort === "sellPrice"
    || filters.expiryWindows.length > 0
    || filters.stockLevels.length > 0
    || filters.stockRange !== null;
}

function lowerValues(values: string[]): string[] {
  return values.map((value) => value.toLocaleLowerCase("en-US"));
}

const totalStockSql = Prisma.sql`COALESCE(SUM(batch."availableStock"), 0)`;
const firstSellPriceSql = Prisma.sql`
  COALESCE(
    (
      SELECT price_batch."sellPriceThb"
      FROM "ProductBatch" price_batch
      WHERE price_batch."productId" = product.id
      ORDER BY price_batch."expiryDate" ASC, price_batch."batchNo" ASC
      LIMIT 1
    ),
    0
  )
`;
const nearestExpirySql = Prisma.sql`
  MIN(
    CASE
      WHEN batch."expiryDate" ~ '^\\d{4}-\\d{2}-\\d{2}$'
        THEN TO_DATE(batch."expiryDate", 'YYYY-MM-DD')
      WHEN batch."expiryDate" ~ '^\\d{2}/\\d{2}/\\d{4}$'
        THEN TO_DATE(batch."expiryDate", 'DD/MM/YYYY')
      ELSE NULL
    END
  )
`;

function stockLevelCondition(level: string): Prisma.Sql {
  if (level === "Out of Stock") return Prisma.sql`${totalStockSql} <= 0`;
  if (level === "Low Stock") {
    return Prisma.sql`(${totalStockSql} > 0 AND ${totalStockSql} < product."minimumStock")`;
  }
  if (level === "Overstock") return Prisma.sql`${totalStockSql} > product."maximumStock"`;
  return Prisma.sql`(${totalStockSql} >= product."minimumStock" AND ${totalStockSql} <= product."maximumStock")`;
}

function expiryWindowCondition(window: string): Prisma.Sql {
  if (window === "No expiry date") return Prisma.sql`${nearestExpirySql} IS NULL`;
  if (window === "Expired") return Prisma.sql`${nearestExpirySql} < CURRENT_DATE`;
  if (window === "Within 30 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE AND CURRENT_DATE + 30`;
  }
  if (window === "31–90 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 90`;
  }
  if (window === "91–180 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE + 91 AND CURRENT_DATE + 180`;
  }
  if (window === "181–365 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE + 181 AND CURRENT_DATE + 365`;
  }
  return Prisma.sql`${nearestExpirySql} > CURRENT_DATE + 365`;
}

function filteredStockOrderBy(input: StockReadQuery): Prisma.Sql {
  if (input.sort === "weekly") {
    return Prisma.sql`product."weeklySold" DESC, product."itemName" ASC, product.id ASC`;
  }

  const direction = input.sortDirection === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  if (input.sort === "minimum") {
    return Prisma.sql`product."minimumStock" ${direction}, product."itemName" ASC, product.id ASC`;
  }
  if (input.sort === "maximum") {
    return Prisma.sql`product."maximumStock" ${direction}, product."itemName" ASC, product.id ASC`;
  }
  if (input.sort === "stock") {
    return Prisma.sql`${totalStockSql} ${direction}, product."itemName" ASC, product.id ASC`;
  }
  if (input.sort === "sellPrice") {
    return Prisma.sql`${firstSellPriceSql} ${direction}, product."itemName" ASC, product.id ASC`;
  }
  return input.sortDirection === "desc"
    ? Prisma.sql`product."itemName" DESC, product.id DESC`
    : Prisma.sql`product."itemName" ASC, product.id ASC`;
}

async function readFilteredStockProductIds(
  input: StockReadQuery,
): Promise<{ ids: string[]; total: number }> {
  const where: Prisma.Sql[] = [Prisma.sql`product."isActive" = TRUE`];
  const having: Prisma.Sql[] = [];
  const { filters } = input;

  if (input.query) {
    const pattern = `%${input.query}%`;
    where.push(Prisma.sql`(
      product."itemName" ILIKE ${pattern}
      OR product."brandName" ILIKE ${pattern}
      OR product."barcode" ILIKE ${pattern}
      OR product."externalProductCode" ILIKE ${pattern}
      OR manufacturer.name ILIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM "ProductBarcodeAlias" alias
        WHERE alias."productId" = product.id AND alias.barcode ILIKE ${pattern}
      )
      OR EXISTS (
        SELECT 1
        FROM "ProductParentPack" parent_pack
        LEFT JOIN "ProductBarcodeAlias" parent_alias ON parent_alias."parentPackId" = parent_pack.id
        WHERE parent_pack."productId" = product.id
          AND (parent_pack.barcode ILIKE ${pattern} OR parent_alias.barcode ILIKE ${pattern})
      )
    )`);
  }
  if (filters.categories.length > 0) {
    where.push(Prisma.sql`LOWER(category.name) IN (${Prisma.join(lowerValues(filters.categories))})`);
  }
  if (filters.dosageTypes.length > 0) {
    where.push(Prisma.sql`LOWER(product."childUnit") IN (${Prisma.join(lowerValues(filters.dosageTypes))})`);
  }
  if (filters.manufacturers.length > 0) {
    where.push(Prisma.sql`LOWER(manufacturer.name) IN (${Prisma.join(lowerValues(filters.manufacturers))})`);
  }
  if (filters.tags.length > 0) {
    where.push(Prisma.sql`LOWER(product."tagName") IN (${Prisma.join(lowerValues(filters.tags))})`);
  }
  if (filters.stockLevels.length > 0) {
    having.push(Prisma.sql`(${Prisma.join(filters.stockLevels.map(stockLevelCondition), " OR ")})`);
  }
  if (filters.expiryWindows.length > 0) {
    having.push(Prisma.sql`(${Prisma.join(filters.expiryWindows.map(expiryWindowCondition), " OR ")})`);
  }
  if (filters.stockRange?.min !== null && filters.stockRange?.min !== undefined) {
    having.push(Prisma.sql`${totalStockSql} >= ${filters.stockRange.min}`);
  }
  if (filters.stockRange?.max !== null && filters.stockRange?.max !== undefined) {
    having.push(Prisma.sql`${totalStockSql} <= ${filters.stockRange.max}`);
  }

  const orderBy = filteredStockOrderBy(input);
  const offset = (input.page - 1) * input.pageSize;
  const rows = await prisma.$queryRaw<Array<{ id: string; total: number }>>(Prisma.sql`
    SELECT product.id, COUNT(*) OVER()::integer AS total
    FROM "Product" product
    INNER JOIN "Category" category ON category.id = product."categoryId"
    INNER JOIN "Manufacturer" manufacturer ON manufacturer.id = product."manufacturerId"
    LEFT JOIN "ProductBatch" batch ON batch."productId" = product.id
    WHERE ${Prisma.join(where, " AND ")}
    GROUP BY product.id
    ${having.length > 0 ? Prisma.sql`HAVING ${Prisma.join(having, " AND ")}` : Prisma.empty}
    ORDER BY ${orderBy}
    LIMIT ${input.pageSize}
    OFFSET ${offset}
  `);
  return {
    ids: rows.map((row) => row.id),
    total: Number(rows[0]?.total ?? 0),
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
  if (input.productIds.length === 0 && requiresAggregateStockRead(input)) {
    const filtered = await readFilteredStockProductIds(input);
    if (filtered.ids.length === 0) {
      return {
        products: [],
        page: input.page,
        pageSize: input.pageSize,
        total: filtered.total,
        hasMore: false,
      };
    }
    const rows = await prisma.product.findMany({
      where: { id: { in: filtered.ids } },
      include: productGraph,
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const orderedRows = filtered.ids
      .map((id) => rowById.get(id))
      .filter((row): row is StockProductRow => Boolean(row));
    return {
      products: await rowsToSalesProducts(orderedRows),
      page: input.page,
      pageSize: input.pageSize,
      total: filtered.total,
      hasMore: input.page * input.pageSize < filtered.total,
    };
  }

  const where = stockProductWhere(input);
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = input.sort === "weekly"
    ? [{ weeklySold: "desc" }, { itemName: "asc" }, { id: "asc" }]
    : input.sort === "minimum"
      ? [{ minimumStock: input.sortDirection }, { itemName: "asc" }, { id: "asc" }]
      : input.sort === "maximum"
        ? [{ maximumStock: input.sortDirection }, { itemName: "asc" }, { id: "asc" }]
        : [{ itemName: input.sortDirection }, { id: input.sortDirection }];
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

export class StockProductNotFoundError extends Error {}

export type BulkStockPhotoStorageResult = {
  eligibleCount: number;
  storedCount: number;
  failedCount: number;
};

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

export async function storeStockProductPhoto(
  productId: string,
  photoUrl: string,
  reviewedBy: string,
): Promise<SalesProduct> {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });
  if (!product) throw new StockProductNotFoundError("Stock item was not found.");

  const prepared = await prepareManualProductImageImport(product.id, photoUrl);
  if (!prepared) throw new Error("A public external photo URL is required.");
  await prisma.$transaction((tx) => persistManualProductImageImport(tx, {
    ...prepared,
    productId: product.id,
    reviewedBy,
  }));
  await cleanupManualProductImageObjects(product.id, prepared.storageKey);
  const savedProduct = await readStockProduct(product.id);
  if (!savedProduct) throw new StockProductNotFoundError("Stock item was not found.");
  return savedProduct;
}

const STOCK_PHOTO_IMPORT_CONCURRENCY = 3;

function validatedExternalPhotoUrl(photoUrl: string): string | null {
  try {
    const source = parseManualProductImageUrl(photoUrl);
    if (!source || isPlaceholderProductImageUrl(source.toString())) return null;
    return source.toString();
  } catch {
    return null;
  }
}

export async function storeAllExternalStockPhotos(
  reviewedBy: string,
): Promise<BulkStockPhotoStorageResult> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      imageUrl: { startsWith: "https://" },
    },
    select: { id: true, imageUrl: true },
    orderBy: [{ itemName: "asc" }, { id: "asc" }],
  });
  const eligibleProducts = products.flatMap((product) => {
    const photoUrl = validatedExternalPhotoUrl(product.imageUrl);
    return photoUrl ? [{ productId: product.id, photoUrl }] : [];
  });
  let nextIndex = 0;
  let storedCount = 0;
  let failedCount = 0;

  async function importNextPhoto(): Promise<void> {
    while (nextIndex < eligibleProducts.length) {
      const product = eligibleProducts[nextIndex];
      nextIndex += 1;
      try {
        await storeStockProductPhoto(product.productId, product.photoUrl, reviewedBy);
        storedCount += 1;
      } catch {
        failedCount += 1;
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(STOCK_PHOTO_IMPORT_CONCURRENCY, eligibleProducts.length) },
      () => importNextPhoto(),
    ),
  );
  return {
    eligibleCount: eligibleProducts.length,
    storedCount,
    failedCount,
  };
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
