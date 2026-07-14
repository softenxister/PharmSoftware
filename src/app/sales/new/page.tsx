import NewSale from "./NewSale";
import { useAuth } from "@/app/AuthProvider";

export default function NewSalePage() {
  const { user } = useAuth();
  if (!user) return null;
  return <NewSale user={user} />;
}
