import { SettingsWorkspace } from "@/features/settings/SettingsWorkspace";
import { useAuth } from "@/app/providers/AuthProvider";

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  if (!user) return null;
  return <SettingsWorkspace user={user} onUserUpdated={setUser} />;
}
