import { SettingsWorkspace } from "./SettingsWorkspace";
import { useAuth } from "@/app/AuthProvider";

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  if (!user) return null;
  return <SettingsWorkspace user={user} onUserUpdated={setUser} />;
}
