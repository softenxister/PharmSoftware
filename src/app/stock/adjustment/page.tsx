import { StockAdjustment } from "./StockAdjustment";
import { useSearchParams } from "react-router";

export default function StockAdjustmentPage() {
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get("purchaseId")?.trim() || undefined;
  const requestId = searchParams.get("requestId")?.trim() || undefined;
  return <StockAdjustment initialPurchaseId={purchaseId} initialRequestId={requestId} />;
}
