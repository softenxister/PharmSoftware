import SalesHome from "@/features/sales/SalesHome";
import { useSearchParams } from "react-router";

export default function SalesPage() {
  const [searchParams] = useSearchParams();
  const requestedStatus = searchParams.get("status") || "all";
  const initialStatus = requestedStatus === "paid" || requestedStatus === "pending" || requestedStatus === "void"
    ? requestedStatus
    : "all";
  return <SalesHome initialStatus={initialStatus} />;
}
