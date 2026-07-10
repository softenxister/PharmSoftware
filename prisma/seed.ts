import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  PurchaseBillStatus,
  SaleStatus,
} from "../src/generated/prisma/client";
import {
  customers,
  recentSales,
  salesProducts,
} from "./seedData";
import type { SavedStockItem } from "../src/server/db/types";
import {
  mergeStockSeedData,
  type StockProductOverride,
} from "../src/server/db/stockDataMapper";
import type { SavedPurchaseBill } from "../src/server/db/purchaseRepository";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const seedDataDirectory = path.join(process.cwd(), "prisma/seed-data");

const distributorSeeds = [
  "PharmaCo Ltd.",
  "MediSupply Co.",
  "HealthDist Inc.",
  "BioPharm Group",
  "GenericMeds Ltd.",
  "Siam Medical Supply",
  "Bangkok Pharma Distribution",
  "Greenline Healthcare",
  "Nova Drug Wholesale",
  "Wellcare Logistics",
  "TPD Thanom Pharma Distribution",
  "Buymed Thailand",
  "VORAMIT DRUG CENTER",
];

const counterCustomers = [
  { id: "c1", name: "Suchada Wong", mobile: "081-234-5566", points: 4280, rank: "Platinum", products: ["p-sara", "p-tiffy", "p-airx", "p-gaviscon", "p-betadine"] },
  { id: "c2", name: "Kridsada Phan", mobile: "089-771-2201", points: 2150, rank: "Gold", products: ["p-blackmores-c", "p-natc", "p-nivea-sun", "p-dentiste", "p-nexcare"] },
  { id: "c3", name: "Areeya Somboon", mobile: "086-005-9981", points: 980, rank: "Silver", products: ["p-zyrtec", "p-tylenol", "p-ors", "p-smooth-e"] },
  { id: "c4", name: "Natthapong Lee", mobile: "090-441-7723", points: 310, rank: "Regular", products: ["p-gaviscon", "p-sara", "p-durex"] },
];

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

function saleDate(value: string): Date {
  return new Date(`${value.replace(" ", "T")}:00+07:00`);
}

function purchaseStatus(value: SavedPurchaseBill["status"]): PurchaseBillStatus {
  if (value === "draft") return PurchaseBillStatus.DRAFT;
  if (value === "partial") return PurchaseBillStatus.PARTIAL;
  return PurchaseBillStatus.RECEIVED;
}

async function seedProducts() {
  const savedItems = await readJsonFile<SavedStockItem[]>("stock-items.json");
  const overrides = await readJsonFile<StockProductOverride[]>("stock-overrides.json");
  const products = mergeStockSeedData(salesProducts, savedItems, overrides);

  for (const product of products) {
    const [category, manufacturer] = await Promise.all([
      prisma.category.upsert({
        where: { name: product.category || "Uncategorized" },
        update: {},
        create: { name: product.category || "Uncategorized" },
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
        where: { productId_packUnit: { productId: product.id, packUnit: pack.packUnit } },
        update: {
          childPackUnit: pack.childPackUnit,
          childPackQuantity: pack.childPackQuantity,
          label: pack.label,
          priceMultiplier: pack.priceMultiplier,
        },
        create: {
          productId: product.id,
          packUnit: pack.packUnit,
          childPackUnit: pack.childPackUnit,
          childPackQuantity: pack.childPackQuantity,
          label: pack.label,
          priceMultiplier: pack.priceMultiplier,
        },
      });
    }

    for (const batch of product.batches) {
      await prisma.productBatch.upsert({
        where: { productId_batchNo: { productId: product.id, batchNo: batch.batchNo } },
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

  for (const customer of customers) {
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

  for (const customer of counterCustomers) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: { name: customer.name, mobile: customer.mobile, isMember: true, points: customer.points, membershipRank: customer.rank },
      create: { id: customer.id, name: customer.name, mobile: customer.mobile, isMember: true, points: customer.points, membershipRank: customer.rank },
    });

    const favorites = customer.products.filter((productId) => productIds.has(productId));
    if (favorites.length > 0) {
      await prisma.customerFavoriteProduct.createMany({
        data: favorites.map((productId) => ({ customerId: customer.id, productId })),
        skipDuplicates: true,
      });
    }
  }
}

async function seedDistributors(purchaseBills: SavedPurchaseBill[]) {
  const names = new Set([
    ...distributorSeeds,
    ...purchaseBills.map((bill) => bill.distributor).filter(Boolean),
  ]);

  for (const name of names) {
    await prisma.distributor.upsert({ where: { name }, update: {}, create: { name } });
  }
}

async function seedPurchases(purchaseBills: SavedPurchaseBill[]) {
  for (const bill of purchaseBills) {
    const distributor = await prisma.distributor.findUnique({ where: { name: bill.distributor } });
    await prisma.purchaseBill.upsert({
      where: { id: bill.id },
      update: {
        billNo: bill.billNo,
        invoiceNo: bill.invoiceNo,
        purchasedAt: new Date(bill.date),
        distributorId: distributor?.id ?? null,
        distributorName: bill.distributor,
        itemCount: bill.itemCount,
        totalQty: bill.totalQty,
        netTotal: bill.netTotal,
        status: purchaseStatus(bill.status),
      },
      create: {
        id: bill.id,
        billNo: bill.billNo,
        invoiceNo: bill.invoiceNo,
        purchasedAt: new Date(bill.date),
        distributorId: distributor?.id ?? null,
        distributorName: bill.distributor,
        itemCount: bill.itemCount,
        totalQty: bill.totalQty,
        netTotal: bill.netTotal,
        status: purchaseStatus(bill.status),
        lines: {
          create: bill.lines.map((line) => ({
            id: line.id,
            productId: line.productId,
            barcode: line.barcode,
            itemName: line.itemName,
            unit: line.unit,
            unitMultiplier: line.unitMultiplier,
            quantity: line.quantity,
            cost: line.cost,
            freeUnit: line.freeUnit,
            freeUnitMultiplier: line.freeUnitMultiplier,
            freeQuantity: line.freeQuantity,
            batchNo: line.batchNo,
            expiryDate: line.expiryDate,
          })),
        },
      },
    });
  }
}

async function seedRecentSales() {
  const customerRows = await prisma.customer.findMany({ select: { id: true, name: true, isMember: true } });

  for (const sale of recentSales) {
    const customer = customerRows.find((row) => row.name === sale.customerName);
    const status = sale.status === "Paid"
      ? SaleStatus.PAID
      : sale.status === "Voided"
        ? SaleStatus.VOIDED
        : SaleStatus.PENDING;

    await prisma.sale.upsert({
      where: { id: sale.id },
      update: {},
      create: {
        id: sale.id,
        billNo: sale.billNo,
        soldAt: saleDate(sale.billDate),
        customerId: customer?.id ?? null,
        customerName: sale.customerName,
        isMember: customer?.isMember ?? false,
        itemCount: sale.uniqueItems,
        totalQuantity: sale.totalQuantity,
        paymentMethod: sale.paymentMethod,
        purchaseMethod: "pickup",
        subtotal: sale.netPayableThb,
        netTotal: sale.netPayableThb,
        status,
      },
    });
  }
}

async function main() {
  const purchaseBills = await readJsonFile<SavedPurchaseBill[]>("purchase-bills.json");
  const productIds = await seedProducts();
  await seedPeople(productIds);
  await seedDistributors(purchaseBills);
  await seedPurchases(purchaseBills);
  await seedRecentSales();

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
