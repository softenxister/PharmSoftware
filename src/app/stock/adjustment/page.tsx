import { StockAdjustment } from "./StockAdjustment";

type StockAdjustmentPageProps = {
  searchParams?: {
    purchaseId?: string | string[];
    requestId?: string | string[];
  };
};

export default function StockAdjustmentPage({ searchParams }: StockAdjustmentPageProps) {
  const purchaseId = typeof searchParams?.purchaseId === "string" ? searchParams.purchaseId : undefined;
  const requestId = typeof searchParams?.requestId === "string" ? searchParams.requestId : undefined;
  return <StockAdjustment initialPurchaseId={purchaseId} initialRequestId={requestId} />;
}
