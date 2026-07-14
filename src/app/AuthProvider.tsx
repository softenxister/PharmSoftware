import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PharmUser } from "@/server/auth/pharmUser";

type AuthContextValue = {
  user: PharmUser | null | undefined;
  setUser: (user: PharmUser | null) => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<PharmUser | null | undefined>(undefined);
  const requestVersion = useRef(0);

  const setUser = useCallback((nextUser: PharmUser | null) => {
    requestVersion.current += 1;
    setUserState(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    try {
      const response = await fetch("/api/current-user", { cache: "no-store" });
      if (version !== requestVersion.current) return;
      if (!response.ok) {
        setUserState(null);
        return;
      }
      const data = await response.json() as { user?: PharmUser };
      if (version === requestVersion.current) setUserState(data.user ?? null);
    } catch {
      if (version === requestVersion.current) setUserState(null);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const value = useMemo(() => ({ user, setUser, refreshUser }), [refreshUser, setUser, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
