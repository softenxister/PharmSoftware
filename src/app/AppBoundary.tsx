import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { TopBar } from "@/components/navigation/TopBar";
import { useAuth } from "@/app/providers/AuthProvider";
import { UnsavedChangesProvider } from "@/app/providers/UnsavedChangesProvider";
import { resolveAuthRoute } from "@/app/routing/authRouting";

export function SessionLoading() {
  return (
    <main
      aria-live="polite"
      aria-busy="true"
      style={{
        alignItems: "center",
            background: "var(--app-page)",
            color: "var(--app-muted)",
        display: "flex",
        fontSize: "14px",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      Opening your pharmacy workspace…
    </main>
  );
}

export function AppBoundary() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const decision = user === undefined ? null : resolveAuthRoute(location.pathname, user);

  useEffect(() => {
    if (decision?.redirectTo) navigate(decision.redirectTo, { replace: true });
  }, [decision?.redirectTo, navigate]);

  if (user === undefined && location.pathname !== "/login") return <SessionLoading />;
  if (decision?.redirectTo) return <SessionLoading />;

  if (decision?.showAppShell && user) {
    return (
      <UnsavedChangesProvider>
        <div className="app-shell">
          <TopBar user={user} />
          <main className="app-main"><Outlet /></main>
        </div>
      </UnsavedChangesProvider>
    );
  }

  return <Outlet />;
}
