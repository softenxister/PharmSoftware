import { randomUUID } from "node:crypto";
import { DiscountType, Prisma, SaleStatus } from "@server/generated/prisma/client";
import { calculateSalePricing } from "@/lib/salePricing";
import {
  earnedMembershipPoints,
  LOWEST_MEMBERSHIP_RANK,
  nextMembershipLoyalty,
} from "@/lib/membershipRank";
import {
  createReceiptSnapshot,
  type ReceiptCostSource,
  type ReceiptStoreSnapshot,
} from "@/lib/receipt";
import { prisma } from "../core/prisma";
import { readStoreProfile } from "../settings/storeProfileRepository";
import {
  dispenseSoldStock,
  type SoldStockLineInput,
} from "../stock/stockMovementRepository";
import { normalizeExpiryDate } from "@/lib/expiryDate";

export type SaleLineInput = {
  lineId: string;
  itemId: string;
  itemName: string;
  packLabel: string;
  packMultiplier: number;
  unitPrice?: number;
  loc: string;
  batch: {
    batchId?: string;
    batchNo: string;
    exp: string;
    sellPrice: number;
    stock?: number;
  };
  qty: number;
};

export type SaleInput = {
  id?: string;
  billNo?: string;
  owner?: { id: string; name: string };
  pharmacist?: { id: string; name: string };
  customer?: { id: string; name: string; mobile?: string; isMember?: boolean } | null;
  paymentMethod: string;
  purchaseMethod: string;
  billDate?: string;
  subtotal: number;
  netPayable: number;
  customerPaid?: number | null;
  changeDue?: number | null;
  discount?: { type: "percent" | "thb"; value: number } | null;
  status: "paid" | "pending";
  lines: SaleLineInput[];
};

export type SavedSaleResult = {
  id: string;
  billNo: string;
  date: string;
  status: "paid" | "pending";
};

export type SaveSaleResult = {
  sale: SavedSaleResult;
};

export class PendingSaleConflictError extends Error {
  constructor(message = "This Pending Sale is no longer available.") {
    super(message);
    this.name = "PendingSaleConflictError";
  }
}

export function assertPendingSaleWritable(
  requestedSaleId: string | undefined,
  currentStatus: SavedSale["status"] | null,
): void {
  if (requestedSaleId?.trim() && currentStatus === null) throw new PendingSaleConflictError();
  if (currentStatus === "paid") {
    throw new PendingSaleConflictError("This Pending Sale has already been paid.");
  }
  if (currentStatus === "void") throw new PendingSaleConflictError();
}

export function parsePendingSaleDeleteRequest(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const saleId = (value as { saleId?: unknown }).saleId;
  return typeof saleId === "string" && saleId.trim() ? saleId.trim() : null;
}

export type SavedSale = {
  id: string;
  billNo: string;
  date: string;
  customerName: string;
  customerMobile: string;
  isMember: boolean;
  itemCount: number;
  paymentMethod: string;
  purchaseMethod: string;
  netTotal: number;
  status: "paid" | "pending" | "void";
  ownerId: string | null;
  billDate: string;
  pharmacistId: string | null;
  customerId: string | null;
  lines: SaleLineInput[];
  discount: { type: "percent" | "thb"; value: number } | null;
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type ProductCostSnapshot = {
  unitCost: number;
  source: ReceiptCostSource;
};

export function receiptLineCostSnapshot(
  cost: ProductCostSnapshot | undefined,
  packMultiplier: number,
): { unitCost?: number; costSource?: ReceiptCostSource } {
  if (!cost || !Number.isFinite(packMultiplier) || packMultiplier <= 0) return {};
  return {
    unitCost: roundCurrency(cost.unitCost * packMultiplier),
    costSource: cost.source,
  };
}

async function readProductCostSnapshots(
  tx: Prisma.TransactionClient,
  productIds: string[],
  observedAt: Date,
): Promise<ReadonlyMap<string, ProductCostSnapshot>> {
  if (productIds.length === 0) return new Map();
  const rows = await tx.$queryRaw<Array<{
    productId: string;
    unitCost: unknown;
    source: unknown;
  }>>(Prisma.sql`
    WITH latest_purchase_costs AS (
      SELECT DISTINCT ON (line."productId")
        line."productId",
        line."cost" / NULLIF(line."unitMultiplier", 0) AS "unitCost"
      FROM "PurchaseLine" line
      INNER JOIN "PurchaseBill" bill ON bill.id = line."purchaseBillId"
      WHERE line."productId" IN (${Prisma.join(productIds)})
        AND bill.status = 'RECEIVED'
        AND bill."purchasedAt" <= ${observedAt}
        AND line."cost" > 0
        AND line."unitMultiplier" > 0
      ORDER BY line."productId", bill."purchasedAt" DESC, bill."createdAt" DESC, line.id DESC
    )
    SELECT
      product.id AS "productId",
      COALESCE(latest."unitCost", product."migrationCostThb") AS "unitCost",
      CASE WHEN latest."unitCost" IS NOT NULL THEN 'latest-purchase' ELSE 'migration' END AS source
    FROM "Product" product
    LEFT JOIN latest_purchase_costs latest ON latest."productId" = product.id
    WHERE product.id IN (${Prisma.join(productIds)})
      AND COALESCE(latest."unitCost", product."migrationCostThb") > 0
  `);
  const costs = new Map<string, ProductCostSnapshot>();
  for (const row of rows) {
    const unitCost = Number(row.unitCost);
    const source = row.source === "latest-purchase" ? "latest-purchase" : "migration";
    if (Number.isFinite(unitCost) && unitCost > 0) costs.set(row.productId, { unitCost, source });
  }
  return costs;
}

export function loyaltyPointsForSale(
  status: SaleInput["status"],
  isMember: boolean,
  netTotal: number,
): number {
  return status === "paid" && isMember ? earnedMembershipPoints(netTotal) : 0;
}

function resolvedLineUnitPrice(line: SaleLineInput): number {
  const explicitPrice = Number(line.unitPrice);
  return line.unitPrice !== undefined && Number.isFinite(explicitPrice)
    ? explicitPrice
    : Number(line.batch.sellPrice) * Number(line.packMultiplier);
}

export function summarizeSaleLines(lines: SaleLineInput[]) {
  const logicalItems = new Set<string>();
  const receiptLines = new Map<string, {
    itemId: string;
    itemName: string;
    packLabel: string;
    packMultiplier: number;
    quantity: number;
    unitPrice: number;
  }>();

  for (const line of lines) {
    const itemId = line.itemId.trim();
    const logicalKey = `${itemId}\u0000${line.packLabel.trim()}\u0000${Number(line.packMultiplier)}`;
    const unitPrice = resolvedLineUnitPrice(line);
    const receiptKey = `${logicalKey}\u0000${unitPrice}`;
    logicalItems.add(logicalKey);

    const existing = receiptLines.get(receiptKey);
    if (existing) {
      existing.quantity += Number(line.qty);
    } else {
      receiptLines.set(receiptKey, {
        itemId,
        itemName: line.itemName,
        packLabel: line.packLabel,
        packMultiplier: Number(line.packMultiplier),
        quantity: Number(line.qty),
        unitPrice,
      });
    }
  }

  return {
    itemCount: logicalItems.size,
    receiptLines: [...receiptLines.values()],
  };
}

function createBillIdentity(input: SaleInput, now: Date) {
  const randomSuffix = randomUUID();
  return {
    id: input.id?.trim() || `sale-${randomSuffix}`,
    billNo: input.billNo?.trim() || `INV-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${randomSuffix.slice(0, 8).toUpperCase()}`,
  };
}

export function validateSale(input: SaleInput) {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("A sale requires at least one item.");
  }
  if (!Number.isFinite(input.subtotal) || input.subtotal <= 0) {
    throw new Error("Sale subtotal is invalid.");
  }
  if (!Number.isFinite(input.netPayable) || input.netPayable <= 0) {
    throw new Error("Sale net payable is invalid.");
  }
  if (!input.paymentMethod?.trim() || !input.purchaseMethod?.trim()) {
    throw new Error("Payment and purchase methods are required.");
  }
  if (input.billDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.billDate)) {
    throw new Error("Sale bill date is invalid.");
  }
  const hasInvalidLine = input.lines.some((line) => (
    !line?.lineId?.trim()
    || !line.itemId?.trim()
    || !line.itemName?.trim()
    || typeof line.batch?.batchNo !== "string"
    || typeof line.batch.exp !== "string"
    || !Number.isFinite(Number(line.qty))
    || Number(line.qty) <= 0
    || !Number.isInteger(Number(line.qty))
    || !Number.isFinite(Number(line.packMultiplier))
    || Number(line.packMultiplier) <= 0
    || !Number.isFinite(Number(line.batch.sellPrice))
    || Number(line.batch.sellPrice) < 0
    || !Number.isFinite(resolvedLineUnitPrice(line))
    || resolvedLineUnitPrice(line) < 0
  ));
  if (hasInvalidLine) throw new Error("One or more sale items are invalid.");
  if (input.status === "paid") {
    const customerPaid = Number(input.customerPaid);
    if (!Number.isFinite(customerPaid) || customerPaid < input.netPayable) {
      throw new Error("Customer payment must cover the net payable amount.");
    }
  }
  if (input.discount && (!Number.isFinite(input.discount.value) || input.discount.value <= 0)) {
    throw new Error("Sale discount is invalid.");
  }
}

function stockLines(lines: SaleLineInput[]): SoldStockLineInput[] {
  return lines.map((line) => ({
    productId: line.itemId.trim(),
    batchNo: line.batch.batchNo.trim(),
    expiryDate: normalizeExpiryDate(line.batch.exp),
    quantity: Number(line.qty),
    unitMultiplier: Number(line.packMultiplier),
  }));
}

async function upsertPeople(tx: Prisma.TransactionClient, input: SaleInput) {
  if (input.owner?.id && input.owner.name) {
    await tx.owner.upsert({
      where: { id: input.owner.id },
      update: { name: input.owner.name },
      create: { id: input.owner.id, name: input.owner.name },
    });
  }
  if (input.pharmacist?.id && input.pharmacist.name) {
    await tx.pharmacist.upsert({
      where: { id: input.pharmacist.id },
      update: { name: input.pharmacist.name },
      create: { id: input.pharmacist.id, name: input.pharmacist.name },
    });
  }
  if (input.customer?.id && input.customer.name) {
    await tx.customer.upsert({
      where: { id: input.customer.id },
      update: {
        name: input.customer.name,
        mobile: input.customer.mobile?.trim() || null,
        isMember: Boolean(input.customer.isMember),
      },
      create: {
        id: input.customer.id,
        name: input.customer.name,
        mobile: input.customer.mobile?.trim() || null,
        isMember: Boolean(input.customer.isMember),
        membershipRank: input.customer.isMember ? LOWEST_MEMBERSHIP_RANK : null,
      },
    });
  }
}

async function awardPaidSaleLoyalty(
  tx: Prisma.TransactionClient,
  customerId: string,
  netTotal: number,
): Promise<void> {
  const [member] = await tx.$queryRaw<Array<{ points: number; isMember: boolean }>>(Prisma.sql`
    SELECT points, "isMember"
    FROM "Customer"
    WHERE id = ${customerId}
    FOR UPDATE
  `);
  if (!member) return;

  const earnedPoints = loyaltyPointsForSale("paid", member.isMember, netTotal);
  if (earnedPoints === 0) return;
  const loyalty = nextMembershipLoyalty(member.points, netTotal);

  await tx.customer.update({
    where: { id: customerId },
    data: {
      points: loyalty.points,
      membershipRank: loyalty.membershipRank,
    },
  });
}

export async function saveSale(input: SaleInput): Promise<SaveSaleResult> {
  validateSale(input);
  const now = new Date();
  const soldAt = input.billDate
    ? new Date(`${input.billDate}T${now.toISOString().slice(11)}`)
    : now;
  if (Number.isNaN(soldAt.getTime())) throw new Error("Sale bill date is invalid.");
  const identity = createBillIdentity(input, now);
  const nextStatus = input.status === "paid" ? SaleStatus.PAID : SaleStatus.PENDING;
  const storeProfile = nextStatus === SaleStatus.PAID ? await readStoreProfile() : null;

  let sale: { id: string; billNo: string; soldAt: Date; status: SaleStatus };
  try {
    sale = await prisma.$transaction(async (tx) => {
      const existingSale = await tx.sale.findUnique({ where: { id: identity.id } });
      assertPendingSaleWritable(input.id, existingSale
        ? existingSale.status === SaleStatus.PAID
          ? "paid"
          : existingSale.status === SaleStatus.VOIDED ? "void" : "pending"
        : null);

    const productIds = [...new Set(input.lines.map((line) => line.itemId.trim()))];
    const pricedProducts = await tx.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, discountPercent: true },
    });
    if (pricedProducts.length !== productIds.length) throw new Error("Sale item was not found in stock.");
    const discountByProduct = new Map(pricedProducts.map((product) => [product.id, product.discountPercent]));
    const productCosts = nextStatus === SaleStatus.PAID
      ? await readProductCostSnapshots(tx, productIds, now)
      : new Map<string, ProductCostSnapshot>();
    const lineSummary = summarizeSaleLines(input.lines);
    const pricing = calculateSalePricing(input.lines.map((line) => ({
      quantity: Number(line.qty),
      unitPrice: resolvedLineUnitPrice(line),
      discountPercent: discountByProduct.get(line.itemId.trim()) ?? 0,
    })), input.discount ?? null);
    validateSale({
      ...input,
      subtotal: pricing.grossSubtotal,
      netPayable: pricing.netPayable,
    });
    const canonicalCustomerPaid = nextStatus === SaleStatus.PAID ? roundCurrency(Number(input.customerPaid)) : null;
    const canonicalChangeDue = canonicalCustomerPaid === null
      ? null
      : roundCurrency(Math.max(canonicalCustomerPaid - pricing.netPayable, 0));

    await upsertPeople(tx, input);
    const receiptSnapshot = storeProfile ? createReceiptSnapshot({
      saleId: identity.id,
      billNo: identity.billNo,
      soldAt: soldAt.toISOString(),
      customerName: input.customer?.name || "Walk-in Customer",
      salespersonName: input.pharmacist?.name?.trim() || input.owner?.name?.trim() || "ไม่ระบุ",
      paymentMethod: input.paymentMethod,
      customerPaid: canonicalCustomerPaid ?? 0,
      changeDue: canonicalChangeDue ?? 0,
      billDiscountAmount: pricing.billDiscountAmount,
      expectedNetTotal: pricing.netPayable,
      store: {
        storeName: storeProfile.storeName,
        address: storeProfile.address,
        phone: storeProfile.phone,
        email: storeProfile.email,
        taxId: storeProfile.taxId,
        lineId: storeProfile.lineId,
        facebookPage: storeProfile.facebookPage,
        openingTime: storeProfile.openingTime,
        closingTime: storeProfile.closingTime,
      } satisfies ReceiptStoreSnapshot,
      lines: lineSummary.receiptLines.map((line, position) => ({
        position,
        productId: line.itemId,
        packLabel: line.packLabel,
        ...receiptLineCostSnapshot(productCosts.get(line.itemId), line.packMultiplier),

        itemName: line.itemName,
        quantity: line.quantity,
        originalUnitPrice: line.unitPrice,
        discountPercent: discountByProduct.get(line.itemId) ?? 0,
      })),
    }) : null;
    if (nextStatus === SaleStatus.PAID) {
      await dispenseSoldStock(tx, stockLines(input.lines));
    }

    const discountType = input.discount?.type === "percent"
      ? DiscountType.PERCENT
      : input.discount?.type === "thb"
        ? DiscountType.THB
        : null;
    const saleData = {
      billNo: identity.billNo,
      soldAt,
      customerId: input.customer?.id || null,
      customerName: input.customer?.name || "Walk-in Customer",
      isMember: Boolean(input.customer?.isMember),
      itemCount: lineSummary.itemCount,
      totalQuantity: input.lines.reduce((sum, line) => sum + Number(line.qty), 0),
      paymentMethod: input.paymentMethod.trim(),
      purchaseMethod: input.purchaseMethod.trim(),
      subtotal: pricing.grossSubtotal,
      netTotal: pricing.netPayable,
      customerPaid: canonicalCustomerPaid,
      changeDue: canonicalChangeDue,
      status: nextStatus,
      ownerId: input.owner?.id || null,
      pharmacistId: input.pharmacist?.id || null,
      discountType,
      discountValue: input.discount?.value ?? null,
      receiptSnapshot: receiptSnapshot
        ? receiptSnapshot as unknown as Prisma.InputJsonValue
        : Prisma.DbNull,
    };

    const lineCreates = input.lines.map((line, position) => ({
      id: line.lineId,
      productId: line.itemId,
      itemName: line.itemName,
      packLabel: line.packLabel,
      packMultiplier: line.packMultiplier,
      location: line.loc,
      batchNo: line.batch.batchNo,
      expiryDate: normalizeExpiryDate(line.batch.exp),
      sellPriceThb: line.batch.sellPrice,
      unitPriceThb: resolvedLineUnitPrice(line),
      quantity: line.qty,
      position,
    }));

    let savedSale;
    if (existingSale) {
      await tx.saleLine.deleteMany({ where: { saleId: identity.id } });
      savedSale = await tx.sale.update({
        where: { id: identity.id },
        data: { ...saleData, lines: { create: lineCreates } },
      });
    } else {
      savedSale = await tx.sale.create({
        data: {
          id: identity.id,
          ...saleData,
          lines: { create: lineCreates },
        },
      });
    }

    if (nextStatus === SaleStatus.PAID && input.customer?.id) {
      await awardPaidSaleLoyalty(tx, input.customer.id, pricing.netPayable);
    }

      return savedSale;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (
      input.id?.trim()
      && error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2025"
    ) {
      throw new PendingSaleConflictError();
    }
    throw error;
  }

  return {
    sale: {
      id: sale.id,
      billNo: sale.billNo,
      date: sale.soldAt.toISOString(),
      status: sale.status === SaleStatus.PAID ? "paid" : "pending",
    },
  };
}

export async function deletePendingSale(saleId: string): Promise<string | null> {
  const id = saleId.trim();
  if (!id) return null;
  const deleted = await prisma.sale.deleteMany({
    where: { id, status: SaleStatus.PENDING },
  });
  return deleted.count === 1 ? id : null;
}

export async function readSales(saleId?: string): Promise<SavedSale[]> {
  const sales = await prisma.sale.findMany({
    where: saleId ? { id: saleId } : undefined,
    include: {
      customer: { select: { mobile: true } },
      lines: {
        include: { product: { include: { batches: true } } },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      },
    },
    orderBy: { soldAt: "desc" },
    take: saleId ? 1 : 100,
  });

  return sales.map((sale) => ({
    id: sale.id,
    billNo: sale.billNo,
    date: sale.soldAt.toISOString(),
    customerName: sale.customerName,
    customerMobile: sale.customer?.mobile ?? "",
    isMember: sale.isMember,
    itemCount: sale.itemCount,
    paymentMethod: sale.paymentMethod,
    purchaseMethod: sale.purchaseMethod,
    netTotal: Number(sale.netTotal),
    status: sale.status === SaleStatus.PAID
      ? "paid"
      : sale.status === SaleStatus.VOIDED
        ? "void"
        : "pending",
    ownerId: sale.ownerId,
    billDate: sale.soldAt.toISOString().slice(0, 10),
    pharmacistId: sale.pharmacistId,
    customerId: sale.customerId,
    lines: sale.lines.map((line) => ({
      lineId: line.id,
      itemId: line.productId,
      itemName: line.itemName,
      packLabel: line.packLabel,
      packMultiplier: Number(line.packMultiplier),
      unitPrice: Number(line.unitPriceThb ?? Number(line.sellPriceThb) * Number(line.packMultiplier)),
      loc: line.location,
      batch: {
        batchId: `${line.productId}-${line.batchNo}-${line.expiryDate}`,
        batchNo: line.batchNo,
        exp: line.expiryDate,
        sellPrice: Number(line.sellPriceThb),
        stock: Number(line.product.batches.find((batch) => (
          batch.batchNo === line.batchNo && batch.expiryDate === line.expiryDate
        ))?.availableStock ?? 0),
      },
      qty: Number(line.quantity),
    })),
    discount: sale.discountType
      ? {
          type: sale.discountType === DiscountType.PERCENT ? "percent" : "thb",
          value: Number(sale.discountValue ?? 0),
        }
      : null,
  }));
}
