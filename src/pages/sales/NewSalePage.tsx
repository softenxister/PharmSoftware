import NewSale from "@/features/sales/new/NewSale";
import { useAuth } from "@/app/providers/AuthProvider";

export default function NewSalePage() {
  const { user } = useAuth();
  if (!user) return null;
  return <NewSale user={user} />;
}
