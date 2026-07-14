import { PurchaseEntry } from "./PurchaseEntry";
import { useSearchParams } from "react-router";

export default function NewPurchasePage() {
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get("id")?.trim() || undefined;
  return <PurchaseEntry purchaseId={purchaseId} />;
}
