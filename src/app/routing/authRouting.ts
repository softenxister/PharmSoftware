import type { PharmUser } from "@server/auth/pharmUser";

export type AuthRouteDecision = {
  redirectTo: string | null;
  showAppShell: boolean;
};

export function resolveAuthRoute(pathname: string, user: PharmUser | null): AuthRouteDecision {
  const isLogin = pathname === "/login";
  const isPasswordChange = pathname === "/change-password";
  const isReceiptPreview = pathname.startsWith("/sales/receipt/");

  if (!user) {
    return {
      redirectTo: isLogin ? null : "/login",
      showAppShell: false,
    };
  }

  if (user.mustChangePassword) {
    return {
      redirectTo: isPasswordChange ? null : "/change-password",
      showAppShell: false,
    };
  }

  if (isLogin || isPasswordChange) {
    return { redirectTo: "/", showAppShell: false };
  }

  return { redirectTo: null, showAppShell: !isReceiptPreview };
}
