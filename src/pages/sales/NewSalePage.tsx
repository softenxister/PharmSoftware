import NewSale from "@/features/sales/new/NewSale";
import { useAuth } from "@/app/providers/AuthProvider";
import { useSearchParams } from "react-router";

export default function NewSalePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const billId = searchParams.get("billId")?.trim() || null;
  if (!user) return null;
  return <NewSale key={billId ? `pending:${billId}` : "new"} user={user} />;
}
