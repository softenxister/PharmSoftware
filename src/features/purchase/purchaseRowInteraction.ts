export type PurchaseBillStatus = "received" | "draft" | "partial";

export function isEditablePurchaseBillRow(status: PurchaseBillStatus): boolean {
  return status === "draft";
}

export function isPurchaseBillRowActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}
