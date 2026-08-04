import { randomUUID } from "node:crypto";
import { Prisma, SaleStatus } from "@server/generated/prisma/client";
import { LOWEST_MEMBERSHIP_RANK, normalizeMembershipRank } from "@/lib/membershipRank";
import { prisma } from "../core/prisma";
import type { MemberProfileInput } from "./memberValidation";
import type { IngredientSummary } from "../types";
import {
  combineMemberPurchaseHistory,
  type MemberPurchaseHistoryRecord,
} from "./memberPurchaseHistory";

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

type MemberTransaction = {
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

type MemberAvatarProjection = {
  id: string;
  hasAvatar: boolean;
  externalAvatarUrl: string | null;
  updatedAt: Date;
};

type MemberListRow = MemberAvatarProjection & {
  name: string;
  mobile: string;
  registeredAt: Date;
  lastOrderAt: Date | null;
  totalPurchase: number;
  points: number;
  membershipRank: string;
  topItemIds: string[];
  allergies: Array<{ id: string; canonicalName: string; thaiName: string | null }>;
};

type MemberDetailLineRow = {
  id: string;
  productId: string;
  itemName: string;
  packLabel: string;
  quantity: number;
  packMultiplier: number;
  sellPriceThb: number;
  childUnit: string;
};

type MemberDetailSaleRow = {
  id: string;
  billNo: string;
  soldAt: string;
  status: SaleStatus;
  itemCount: number;
  paymentMethod: string;
  purchaseMethod: string;
  netTotal: number;
  lines: MemberDetailLineRow[];
};

type MemberDetailRow = MemberAvatarProjection & {
  name: string;
  mobile: string;
  registeredAt: Date;
  points: number;
  membershipRank: string;
  allergies: Array<{ id: string; canonicalName: string; thaiName: string | null }>;
  sales: MemberDetailSaleRow[];
};

type ImportedMemberPurchaseRow = {
  id: string;
  sourceFileHash: string;
  productId: string;
  itemName: string;
  unit: string;
  quantity: number;
  totalAmount: number;
  purchasedAt: Date;
};

function memberAvatarReference(member: MemberAvatarProjection): string | null {
  if (member.externalAvatarUrl) return member.externalAvatarUrl;
  if (!member.hasAvatar) return null;
  const version = member.updatedAt.getTime();
  return `/api/members/avatar?memberId=${encodeURIComponent(member.id)}&v=${version}`;
}

function ingredientSummaries(
  allergies: Array<{ id: string; canonicalName: string; thaiName: string | null }>,
): IngredientSummary[] {
  return allergies.map((ingredient) => ({
    id: ingredient.id,
    canonicalName: ingredient.canonicalName,
    ...(ingredient.thaiName ? { thaiName: ingredient.thaiName } : {}),
  }));
}

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
  updatedAt: Date;
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
    avatarUrl: memberAvatarReference({
      id: customer.id,
      hasAvatar: Boolean(customer.avatarUrl),
      externalAvatarUrl: customer.avatarUrl?.startsWith("data:image/") ? null : customer.avatarUrl,
      updatedAt: customer.updatedAt,
    }),
    isMember: true,
    registeredAt: customer.createdAt.toISOString(),
    lastOrderAt: customer.sales[0]?.soldAt.toISOString() ?? null,
    totalPurchase: customer.sales.reduce((sum, sale) => sum + Number(sale.netTotal), 0),
    points: customer.points,
    membershipRank: normalizeMembershipRank(customer.membershipRank),
    topItemIds: [...itemTotals.entries()]
      .sort((first, second) => (
        second[1].quantity - first[1].quantity
        || second[1].lastPurchasedAt - first[1].lastPurchasedAt
      ))
      .slice(0, 10)
      .map(([productId]) => productId),
    allergies: ingredientSummaries(customer.ingredientAllergies.map(({ ingredient }) => ingredient)),
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
  const rows = await prisma.$queryRaw<MemberListRow[]>(Prisma.sql`
    WITH paid_sales AS (
      SELECT s."customerId", s."soldAt", s."netTotal"
      FROM "Sale" s
      WHERE s.status = 'PAID' AND s."customerId" IS NOT NULL
    ),
    sale_summary AS (
      SELECT
        ps."customerId",
        MAX(ps."soldAt") AS "lastOrderAt",
        SUM(ps."netTotal")::double precision AS "totalPurchase"
      FROM paid_sales ps
      GROUP BY ps."customerId"
    ),
    imported_purchase_summary AS (
      SELECT
        chi."customerId",
        MAX(COALESCE(chi."reportEndedAt", chi."createdAt")) AS "lastOrderAt",
        SUM(chi."totalAmount")::double precision AS "totalPurchase"
      FROM "CustomerPurchaseHistoryImport" chi
      GROUP BY chi."customerId"
    ),
    ranked_items AS (
      SELECT
        s."customerId",
        sl."productId",
        SUM(sl.quantity * sl."packMultiplier") AS "totalQuantity",
        MAX(s."soldAt") AS "lastPurchasedAt",
        ROW_NUMBER() OVER (
          PARTITION BY s."customerId"
          ORDER BY SUM(sl.quantity * sl."packMultiplier") DESC, MAX(s."soldAt") DESC
        ) AS rank
      FROM "Sale" s
      JOIN "SaleLine" sl ON sl."saleId" = s.id
      WHERE s.status = 'PAID' AND s."customerId" IS NOT NULL
      GROUP BY s."customerId", sl."productId"
    ),
    top_items AS (
      SELECT
        ri."customerId",
        JSON_AGG(ri."productId" ORDER BY ri."totalQuantity" DESC, ri."lastPurchasedAt" DESC) AS "topItemIds"
      FROM ranked_items ri
      WHERE ri.rank <= 10
      GROUP BY ri."customerId"
    ),
    allergy_summary AS (
      SELECT
        ca."customerId",
        JSON_AGG(
          JSON_BUILD_OBJECT('id', i.id, 'canonicalName', i."canonicalName", 'thaiName', i."thaiName")
          ORDER BY i."canonicalName"
        ) AS allergies
      FROM "CustomerIngredientAllergy" ca
      JOIN "Ingredient" i ON i.id = ca."ingredientId"
      GROUP BY ca."customerId"
    )
    SELECT
      c.id,
      c.name,
      COALESCE(c.mobile, '') AS mobile,
      (c."avatarUrl" IS NOT NULL AND c."avatarUrl" <> '') AS "hasAvatar",
      CASE WHEN c."avatarUrl" LIKE 'data:image/%' THEN NULL ELSE c."avatarUrl" END AS "externalAvatarUrl",
      c."updatedAt",
      c."createdAt" AS "registeredAt",
      GREATEST(ss."lastOrderAt", ips."lastOrderAt") AS "lastOrderAt",
      (
        COALESCE(ss."totalPurchase", 0) + COALESCE(ips."totalPurchase", 0)
      )::double precision AS "totalPurchase",
      c.points,
      COALESCE(NULLIF(BTRIM(c."membershipRank"), ''), 'Bronze') AS "membershipRank",
      COALESCE(ti."topItemIds", '[]'::json) AS "topItemIds",
      COALESCE(a.allergies, '[]'::json) AS allergies
    FROM "Customer" c
    LEFT JOIN sale_summary ss ON ss."customerId" = c.id
    LEFT JOIN imported_purchase_summary ips ON ips."customerId" = c.id
    LEFT JOIN top_items ti ON ti."customerId" = c.id
    LEFT JOIN allergy_summary a ON a."customerId" = c.id
    WHERE c."isMember" = true
    ORDER BY c.name ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    avatarUrl: memberAvatarReference(row),
    isMember: true,
    registeredAt: row.registeredAt.toISOString(),
    lastOrderAt: row.lastOrderAt?.toISOString() ?? null,
    totalPurchase: row.totalPurchase,
    points: row.points,
    membershipRank: normalizeMembershipRank(row.membershipRank),
    topItemIds: row.topItemIds,
    allergies: ingredientSummaries(row.allergies),
  }));
}

export async function readMember(memberId: string) {
  const [customer] = await prisma.$queryRaw<MemberDetailRow[]>(Prisma.sql`
    SELECT
      c.id,
      c.name,
      COALESCE(c.mobile, '') AS mobile,
      (c."avatarUrl" IS NOT NULL AND c."avatarUrl" <> '') AS "hasAvatar",
      CASE WHEN c."avatarUrl" LIKE 'data:image/%' THEN NULL ELSE c."avatarUrl" END AS "externalAvatarUrl",
      c."updatedAt",
      c."createdAt" AS "registeredAt",
      c.points,
      COALESCE(NULLIF(BTRIM(c."membershipRank"), ''), 'Bronze') AS "membershipRank",
      COALESCE((
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT('id', i.id, 'canonicalName', i."canonicalName", 'thaiName', i."thaiName")
          ORDER BY i."canonicalName"
        )
        FROM "CustomerIngredientAllergy" ca
        JOIN "Ingredient" i ON i.id = ca."ingredientId"
        WHERE ca."customerId" = c.id
      ), '[]'::json) AS allergies,
      COALESCE((
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', s.id,
            'billNo', s."billNo",
            'soldAt', s."soldAt",
            'status', s.status,
            'itemCount', s."itemCount",
            'paymentMethod', s."paymentMethod",
            'purchaseMethod', s."purchaseMethod",
            'netTotal', s."netTotal"::double precision,
            'lines', COALESCE((
              SELECT JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', sl.id,
                  'productId', sl."productId",
                  'itemName', sl."itemName",
                  'packLabel', sl."packLabel",
                  'quantity', sl.quantity::double precision,
                  'packMultiplier', sl."packMultiplier"::double precision,
                  'sellPriceThb', sl."sellPriceThb"::double precision,
                  'childUnit', p."childUnit"
                ) ORDER BY sl.id ASC
              )
              FROM "SaleLine" sl
              JOIN "Product" p ON p.id = sl."productId"
              WHERE sl."saleId" = s.id
            ), '[]'::json)
          ) ORDER BY s."soldAt" DESC
        )
        FROM "Sale" s
        WHERE s."customerId" = c.id
      ), '[]'::json) AS sales
    FROM "Customer" c
    WHERE c.id = ${memberId} AND c."isMember" = true
  `);
  if (!customer) return null;

  const importedPurchases = await prisma.$queryRaw<ImportedMemberPurchaseRow[]>(Prisma.sql`
    SELECT
      chi.id,
      chi."sourceFileHash",
      chi."productId",
      p."itemName",
      chi.unit,
      chi.quantity::double precision AS quantity,
      chi."totalAmount"::double precision AS "totalAmount",
      COALESCE(chi."reportEndedAt", chi."createdAt") AS "purchasedAt"
    FROM "CustomerPurchaseHistoryImport" chi
    JOIN "Product" p ON p.id = chi."productId"
    WHERE chi."customerId" = ${memberId}
    ORDER BY COALESCE(chi."reportEndedAt", chi."createdAt") DESC, chi."sourceRow" ASC
  `);

  const paidSales = customer.sales.filter((sale) => sale.status === SaleStatus.PAID);
  const itemTotals = new Map<string, { quantity: number; lastPurchasedAt: number }>();
  const purchaseHistoryRecords: MemberPurchaseHistoryRecord[] = [];

  for (const sale of paidSales) {
    for (const line of sale.lines) {
      const itemTotal = itemTotals.get(line.productId) ?? { quantity: 0, lastPurchasedAt: 0 };
      itemTotal.quantity += line.quantity * line.packMultiplier;
      itemTotal.lastPurchasedAt = Math.max(itemTotal.lastPurchasedAt, new Date(sale.soldAt).getTime());
      itemTotals.set(line.productId, itemTotal);

      purchaseHistoryRecords.push({
        recordId: sale.id,
        productId: line.productId,
        itemName: line.itemName,
        unit: line.childUnit,
        quantity: line.quantity * line.packMultiplier,
        totalAmount: line.quantity * line.sellPriceThb * line.packMultiplier,
        purchasedAt: sale.soldAt,
      });
    }
  }

  for (const imported of importedPurchases) {
    purchaseHistoryRecords.push({
      recordId: imported.sourceFileHash,
      productId: imported.productId,
      itemName: imported.itemName,
      unit: imported.unit,
      quantity: imported.quantity,
      totalAmount: imported.totalAmount,
      purchasedAt: imported.purchasedAt.toISOString(),
      purchaseCountKnown: false,
    });
  }

  const purchasedItems = combineMemberPurchaseHistory(purchaseHistoryRecords);
  const importedTotalPurchase = importedPurchases.reduce((sum, row) => sum + row.totalAmount, 0);
  const importedLastPurchasedAt = importedPurchases[0]?.purchasedAt.toISOString() ?? null;
  const paidLastPurchasedAt = paidSales[0]?.soldAt ?? null;
  const lastOrderAt = [paidLastPurchasedAt, importedLastPurchasedAt]
    .filter((value): value is string => Boolean(value))
    .sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0] ?? null;

  const summary: MemberSummary = {
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile,
    avatarUrl: memberAvatarReference(customer),
    isMember: true,
    registeredAt: customer.registeredAt.toISOString(),
    lastOrderAt,
    totalPurchase: paidSales.reduce((sum, sale) => sum + sale.netTotal, 0) + importedTotalPurchase,
    points: customer.points,
    membershipRank: normalizeMembershipRank(customer.membershipRank),
    topItemIds: [...itemTotals.entries()]
      .sort((first, second) => (
        second[1].quantity - first[1].quantity
        || second[1].lastPurchasedAt - first[1].lastPurchasedAt
      ))
      .slice(0, 10)
      .map(([productId]) => productId),
    allergies: ingredientSummaries(customer.allergies),
  };

  return {
    ...summary,
    paidTransactionCount: paidSales.length,
    transactions: customer.sales.map((sale): MemberTransaction => ({
      id: sale.id,
      billNo: sale.billNo,
      soldAt: sale.soldAt,
      status: saleStatus(sale.status),
      itemCount: sale.itemCount,
      paymentMethod: sale.paymentMethod,
      purchaseMethod: sale.purchaseMethod,
      netTotal: sale.netTotal,
      lines: sale.lines.map((line) => ({
        id: line.id,
        itemName: line.itemName,
        packLabel: line.packLabel,
        quantity: line.quantity,
        unitPrice: line.sellPriceThb * line.packMultiplier,
        lineTotal: line.quantity * line.sellPriceThb * line.packMultiplier,
      })),
    })),
    purchasedItems,
  };
}

export async function readMemberAvatar(memberId: string): Promise<string | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: memberId, isMember: true },
    select: { avatarUrl: true },
  });
  return customer?.avatarUrl ?? null;
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
      membershipRank: LOWEST_MEMBERSHIP_RANK,
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
