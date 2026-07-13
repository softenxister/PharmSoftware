import { PurchaseEntry } from "./PurchaseEntry";

type NewPurchasePageProps = {
  searchParams?: { id?: string | string[] };
};

export default function NewPurchasePage({ searchParams }: NewPurchasePageProps) {
  const purchaseId = typeof searchParams?.id === "string" ? searchParams.id : undefined;
  return <PurchaseEntry purchaseId={purchaseId} />;
}
