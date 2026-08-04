import type { MemberRecord } from "../memberData";

export type TransactionStatus = "paid" | "pending" | "void";

export type IngredientOption = {
  id: string;
  canonicalName: string;
  thaiName?: string;
  aliases?: string[];
};

export type MemberTransaction = {
  id: string;
  billNo: string;
  soldAt: string;
  status: TransactionStatus;
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
  historyKey: string;
  productId: string;
  itemName: string;
  totalQuantity: number;
  totalAmount: number;
  unit: string;
  purchaseCount: number | null;
  lastPurchasedAt: string;
};

export type MemberDetailRecord = MemberRecord & {
  paidTransactionCount: number;
  transactions: MemberTransaction[];
  purchasedItems: MemberPurchasedItem[];
};
