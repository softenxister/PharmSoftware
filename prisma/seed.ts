import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../server/generated/prisma/client";
import {
  customers,
  salesProducts,
} from "./seedData";
import type { SavedStockItem } from "../server/db/types";
import {
  mergeStockSeedData,
  type StockProductOverride,
} from "../server/db/stock/stockDataMapper";
import { normalizePostgresConnectionString } from "../server/db/core/postgresConnection";
import { normalizeProductCategory } from "../server/import/productCategoryNormalization";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: normalizePostgresConnectionString(connectionString) }),
});

const seedDataDirectory = path.join(process.cwd(), "prisma/seed-data");

const owners = [
  { id: "o1", name: "Sukhumvit Branch - K. Anong" },
  { id: "o2", name: "Thonglor Branch - K. Preecha" },
  { id: "o3", name: "Head Office Account" },
];

const pharmacists = [
  { id: "p1", name: "Ph. Nattaya S." },
  { id: "p2", name: "Ph. Somchai T." },
  { id: "p3", name: "Ph. Kanokwan R." },
];

async function readJsonFile<T>(fileName: string): Promise<T> {
  const raw = await fs.readFile(path.join(seedDataDirectory, fileName), "utf8");
  return JSON.parse(raw) as T;
}

async function seedProducts() {
  const savedItems = await readJsonFile<SavedStockItem[]>("stock-items.json");
  const overrides = await readJsonFile<StockProductOverride[]>("stock-overrides.json");
  const products = mergeStockSeedData(salesProducts, savedItems, overrides);

  for (const product of products) {
    const categoryName = normalizeProductCategory({
      itemName: product.itemName,
      brandName: product.brandName,
      sourceCategory: product.category,
    });
    const [category, manufacturer] = await Promise.all([
      prisma.category.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
      }),
      prisma.manufacturer.upsert({
        where: { name: product.manufacturerName || "Unknown manufacturer" },
        update: {},
        create: { name: product.manufacturerName || "Unknown manufacturer" },
      }),
    ]);

    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        barcode: product.barcode,
        itemName: product.itemName,
        brandName: product.brandName,
        manufacturerId: manufacturer.id,
        categoryId: category.id,
        packUnit: product.pack.packUnit,
        childUnit: product.pack.childUnit,
        childQuantity: product.pack.childQuantity,
        packLabel: product.pack.label,
        location: product.location,
        imageUrl: product.imageUrl,
        weeklySold: product.weeklySold,
      },
      create: {
        id: product.id,
        barcode: product.barcode,
        itemName: product.itemName,
        brandName: product.brandName,
        manufacturerId: manufacturer.id,
        categoryId: category.id,
        packUnit: product.pack.packUnit,
        childUnit: product.pack.childUnit,
        childQuantity: product.pack.childQuantity,
        packLabel: product.pack.label,
        location: product.location,
        imageUrl: product.imageUrl,
        weeklySold: product.weeklySold,
      },
    });

    for (const pack of product.parentPacks) {
      await prisma.productParentPack.upsert({
        where: {
          productId_packUnit_childPackQuantity: {
            productId: product.id,
            packUnit: pack.packUnit,
            childPackQuantity: pack.childPackQuantity,
          },
        },
        update: {
          childPackUnit: pack.childPackUnit,
          childPackQuantity: pack.childPackQuantity,
          label: pack.label,
          priceMultiplier: pack.priceMultiplier,
          sellPriceThb: pack.sellPriceThb ?? null,
        },
        create: {
          productId: product.id,
          packUnit: pack.packUnit,
          childPackUnit: pack.childPackUnit,
          childPackQuantity: pack.childPackQuantity,
          label: pack.label,
          priceMultiplier: pack.priceMultiplier,
          sellPriceThb: pack.sellPriceThb ?? null,
        },
      });
    }

    for (const batch of product.batches) {
      await prisma.productBatch.upsert({
        where: {
          productId_batchNo_expiryDate: {
            productId: product.id,
            batchNo: batch.batchNo,
            expiryDate: batch.expiryDate,
          },
        },
        update: {
          expiryDate: batch.expiryDate,
          sellPriceThb: batch.sellPriceThb,
        },
        create: {
          productId: product.id,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          sellPriceThb: batch.sellPriceThb,
          availableStock: batch.availableStock,
        },
      });
    }
  }

  return new Set(products.map((product) => product.id));
}

async function seedPeople(productIds: Set<string>) {
  for (const owner of owners) {
    await prisma.owner.upsert({ where: { id: owner.id }, update: { name: owner.name }, create: owner });
  }

  for (const pharmacist of pharmacists) {
    await prisma.pharmacist.upsert({
      where: { id: pharmacist.id },
      update: { name: pharmacist.name },
      create: pharmacist,
    });
  }

  for (const customer of customers.filter((customer) => !customer.isMember)) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: {
        name: customer.name,
        mobile: customer.mobile || null,
        avatarUrl: customer.avatarUrl ?? null,
        isMember: customer.isMember,
      },
      create: {
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile || null,
        avatarUrl: customer.avatarUrl ?? null,
        isMember: customer.isMember,
      },
    });

    const favorites = customer.frequentProductIds.filter((productId) => productIds.has(productId));
    if (favorites.length > 0) {
      await prisma.customerFavoriteProduct.createMany({
        data: favorites.map((productId) => ({ customerId: customer.id, productId })),
        skipDuplicates: true,
      });
    }
  }

}

async function main() {
  const productIds = await seedProducts();
  await seedPeople(productIds);

  const [productCount, batchCount, purchaseCount, saleCount] = await Promise.all([
    prisma.product.count(),
    prisma.productBatch.count(),
    prisma.purchaseBill.count(),
    prisma.sale.count(),
  ]);

  console.log(`Seed complete: ${productCount} products, ${batchCount} batches, ${purchaseCount} purchases, ${saleCount} sales.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
