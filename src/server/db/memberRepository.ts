import { randomUUID } from "node:crypto";
import { SaleStatus } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import type { MemberProfileInput } from "./memberValidation";
import type { IngredientSummary } from "./types";

export type MemberSummary = {
  id: string;
  name: string;
  mobile: string;
  avatarUrl: string | null;
  isMember: true;
  registeredAt: string;
  lastOrderAt: string | null;
  totalPurchase: number;
  points: number;
  membershipRank: string;
  topItemIds: string[];
  allergies: IngredientSummary[];
};

export type MemberTransaction = {
  id: string;
  billNo: string;
  soldAt: string;
  status: "paid" | "pending" | "void";
  itemCount: number;
  paymentMethod: string;
  purchaseMethod: string;
  netTotal: number;
  lines: Array<{
    id: string;
    itemName: string;
    packLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

export type MemberPurchasedItem = {
  productId: string;
  itemName: string;
  totalQuantity: number;
  unit: string;
  purchaseCount: number;
  lastPurchasedAt: string;
};

function saleStatus(status: SaleStatus): MemberTransaction["status"] {
  if (status === SaleStatus.PAID) return "paid";
  if (status === SaleStatus.VOIDED) return "void";
  return "pending";
}

function memberSummary(customer: {
  id: string;
  name: string;
  mobile: string | null;
  avatarUrl: string | null;
  points: number;
  membershipRank: string | null;
  createdAt: Date;
  sales: Array<{
    soldAt: Date;
    netTotal: unknown;
    lines: Array<{ productId: string; quantity: unknown; packMultiplier: unknown }>;
  }>;
  ingredientAllergies: Array<{
    ingredient: { id: string; canonicalName: string; thaiName: string | null };
  }>;
}): MemberSummary {
  const itemTotals = new Map<string, { quantity: number; lastPurchasedAt: number }>();
  for (const sale of customer.sales) {
    for (const line of sale.lines) {
      const current = itemTotals.get(line.productId) ?? { quantity: 0, lastPurchasedAt: 0 };
      current.quantity += Number(line.quantity) * Number(line.packMultiplier);
      current.lastPurchasedAt = Math.max(current.lastPurchasedAt, sale.soldAt.getTime());
      itemTotals.set(line.productId, current);
    }
  }

  return {
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile ?? "",
    avatarUrl: customer.avatarUrl,
    isMember: true,
    registeredAt: customer.createdAt.toISOString(),
    lastOrderAt: customer.sales[0]?.soldAt.toISOString() ?? null,
    totalPurchase: customer.sales.reduce((sum, sale) => sum + Number(sale.netTotal), 0),
    points: customer.points,
    membershipRank: customer.membershipRank?.trim() || "Regular",
    topItemIds: [...itemTotals.entries()]
      .sort((first, second) => (
        second[1].quantity - first[1].quantity
        || second[1].lastPurchasedAt - first[1].lastPurchasedAt
      ))
      .slice(0, 10)
      .map(([productId]) => productId),
    allergies: customer.ingredientAllergies.map(({ ingredient }) => ({
      id: ingredient.id,
      canonicalName: ingredient.canonicalName,
      ...(ingredient.thaiName ? { thaiName: ingredient.thaiName } : {}),
    })),
  };
}

const paidSalesSelection = {
  where: { status: SaleStatus.PAID },
  orderBy: { soldAt: "desc" as const },
  select: {
    soldAt: true,
    netTotal: true,
    lines: { select: { productId: true, quantity: true, packMultiplier: true } },
  },
};

const ingredientAllergiesSelection = {
  orderBy: { ingredient: { canonicalName: "asc" as const } },
  include: {
    ingredient: { select: { id: true, canonicalName: true, thaiName: true } },
  },
};

export async function listMembers(): Promise<MemberSummary[]> {
  const customers = await prisma.customer.findMany({
    where: { isMember: true },
    include: { sales: paidSalesSelection, ingredientAllergies: ingredientAllergiesSelection },
    orderBy: { name: "asc" },
  });
  return customers.map(memberSummary);
}

export async function readMember(memberId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: memberId, isMember: true },
    include: {
      ingredientAllergies: ingredientAllergiesSelection,
      sales: {
        orderBy: { soldAt: "desc" },
        include: {
          lines: {
            orderBy: { id: "asc" },
            include: { product: { select: { childUnit: true } } },
          },
        },
      },
    },
  });
  if (!customer) return null;

  const paidSales = customer.sales.filter((sale) => sale.status === SaleStatus.PAID);
  const summary = memberSummary({ ...customer, sales: paidSales });
  const purchasedItems = new Map<string, MemberPurchasedItem & { saleIds: Set<string> }>();

  for (const sale of paidSales) {
    for (const line of sale.lines) {
      const current = purchasedItems.get(line.productId) ?? {
        productId: line.productId,
        itemName: line.itemName,
        totalQuantity: 0,
        unit: line.product.childUnit,
        purchaseCount: 0,
        lastPurchasedAt: sale.soldAt.toISOString(),
        saleIds: new Set<string>(),
      };
      current.totalQuantity += Number(line.quantity) * Number(line.packMultiplier);
      current.saleIds.add(sale.id);
      purchasedItems.set(line.productId, current);
    }
  }

  return {
    ...summary,
    paidTransactionCount: paidSales.length,
    transactions: customer.sales.map((sale): MemberTransaction => ({
      id: sale.id,
      billNo: sale.billNo,
      soldAt: sale.soldAt.toISOString(),
      status: saleStatus(sale.status),
      itemCount: sale.itemCount,
      paymentMethod: sale.paymentMethod,
      purchaseMethod: sale.purchaseMethod,
      netTotal: Number(sale.netTotal),
      lines: sale.lines.map((line) => ({
        id: line.id,
        itemName: line.itemName,
        packLabel: line.packLabel,
        quantity: Number(line.quantity),
        unitPrice: Number(line.sellPriceThb) * Number(line.packMultiplier),
        lineTotal: Number(line.quantity) * Number(line.sellPriceThb) * Number(line.packMultiplier),
      })),
    })),
    purchasedItems: [...purchasedItems.values()]
      .map(({ saleIds, ...item }) => ({ ...item, purchaseCount: saleIds.size }))
      .sort((first, second) => (
        new Date(second.lastPurchasedAt).getTime() - new Date(first.lastPurchasedAt).getTime()
      )),
  };
}

export async function createMember(input: MemberProfileInput): Promise<MemberSummary> {
  const customer = await prisma.customer.create({
    data: {
      id: `member-${randomUUID()}`,
      name: input.name,
      mobile: input.mobile,
      avatarUrl: input.avatarUrl,
      isMember: true,
      points: 0,
      membershipRank: "Regular",
      ingredientAllergies: input.allergyIngredientIds?.length
        ? { create: input.allergyIngredientIds.map((ingredientId) => ({ ingredientId })) }
        : undefined,
    },
    include: { sales: paidSalesSelection, ingredientAllergies: ingredientAllergiesSelection },
  });
  return memberSummary(customer);
}

export async function updateMember(memberId: string, input: MemberProfileInput): Promise<MemberSummary | null> {
  const existing = await prisma.customer.findFirst({ where: { id: memberId, isMember: true }, select: { id: true } });
  if (!existing) return null;
  const customer = await prisma.customer.update({
    where: { id: memberId },
    data: {
      name: input.name,
      mobile: input.mobile,
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.allergyIngredientIds ? {
        ingredientAllergies: {
          deleteMany: {},
          create: input.allergyIngredientIds.map((ingredientId) => ({ ingredientId })),
        },
      } : {}),
    },
    include: { sales: paidSalesSelection, ingredientAllergies: ingredientAllergiesSelection },
  });
  return memberSummary(customer);
}
