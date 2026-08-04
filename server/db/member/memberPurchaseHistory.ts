export type MemberPurchaseHistoryRecord = {
  recordId: string;
  productId: string;
  itemName: string;
  unit: string;
  quantity: number;
  totalAmount: number;
  purchasedAt: string;
  purchaseCountKnown?: boolean;
};

export type CombinedMemberPurchasedItem = {
  historyKey: string;
  productId: string;
  itemName: string;
  totalQuantity: number;
  totalAmount: number;
  unit: string;
  purchaseCount: number | null;
  lastPurchasedAt: string;
};

export function combineMemberPurchaseHistory(
  records: readonly MemberPurchaseHistoryRecord[],
): CombinedMemberPurchasedItem[] {
  const items = new Map<string, CombinedMemberPurchasedItem & {
    recordIds: Set<string>;
    hasUnknownPurchaseCount: boolean;
  }>();

  for (const record of records) {
    const historyKey = `${record.productId}\0${record.unit}`;
    const current = items.get(historyKey) ?? {
      historyKey,
      productId: record.productId,
      itemName: record.itemName,
      totalQuantity: 0,
      totalAmount: 0,
      unit: record.unit,
      purchaseCount: 0,
      lastPurchasedAt: record.purchasedAt,
      recordIds: new Set<string>(),
      hasUnknownPurchaseCount: false,
    };
    current.totalQuantity += record.quantity;
    current.totalAmount += record.totalAmount;
    current.recordIds.add(record.recordId);
    if (record.purchaseCountKnown === false) current.hasUnknownPurchaseCount = true;
    if (new Date(record.purchasedAt).getTime() > new Date(current.lastPurchasedAt).getTime()) {
      current.lastPurchasedAt = record.purchasedAt;
    }
    items.set(historyKey, current);
  }

  return [...items.values()]
    .map(({ recordIds, hasUnknownPurchaseCount, ...item }) => ({
      ...item,
      purchaseCount: hasUnknownPurchaseCount ? null : recordIds.size,
    }))
    .sort((first, second) => (
      new Date(second.lastPurchasedAt).getTime() - new Date(first.lastPurchasedAt).getTime()
      || first.itemName.localeCompare(second.itemName)
    ));
}
