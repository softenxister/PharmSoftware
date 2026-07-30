import { normalizeExpiryDate } from "@/lib/expiryDate";
import {
  positivePurchaseNumber,
  type EditablePurchaseBill,
  type PurchaseCorrection,
  type PurchaseLine,
} from "./purchaseDraft";

type PersistPurchaseInput = {
  id?: string;
  status: EditablePurchaseBill["status"];
  invoiceNo: string;
  distributor: string;
  totalQty: number;
  netTotal: number;
  lines: PurchaseLine[];
};

export async function persistPurchaseWorkflow(
  input: PersistPurchaseInput,
  fetcher: typeof fetch = fetch,
): Promise<EditablePurchaseBill> {
  const response = await fetcher("/api/purchase", {
    method: input.id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: input.id,
      status: input.status,
      invoiceNo: input.invoiceNo.trim(),
      distributor: input.distributor.trim(),
      totalQty: input.totalQty,
      netTotal: input.netTotal,
      lines: input.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        barcode: line.barcode,
        itemName: line.itemName,
        unit: line.unit,
        unitMultiplier: line.unitMultiplier,
        quantity: positivePurchaseNumber(line.qty),
        cost: positivePurchaseNumber(line.cost),
        freeUnit: line.freeUnit,
        freeUnitMultiplier: line.freeUnitMultiplier,
        freeQuantity: positivePurchaseNumber(line.freeQty),
        batchNo: line.lotNo.trim() || null,
        expiryDate: normalizeExpiryDate(line.expiryDate),
      })),
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || "Unable to save purchase.");
  }
  const data = await response.json() as { bill?: EditablePurchaseBill };
  if (!data.bill) throw new Error("Purchase bill was saved but could not be reloaded.");
  return data.bill;
}

export async function requestPurchaseCorrection(
  purchaseBillId: string,
  reason: string,
  fetcher: typeof fetch = fetch,
): Promise<PurchaseCorrection> {
  const response = await fetcher("/api/purchase-corrections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purchaseBillId, reason: reason.trim() }),
  });
  const data = await response.json() as {
    correctionRequest?: PurchaseCorrection;
    error?: string;
  };
  if (!response.ok || !data.correctionRequest) {
    throw new Error(data.error || "Correction request could not be sent.");
  }
  return data.correctionRequest;
}
