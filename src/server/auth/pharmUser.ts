export type PharmUserRole = "staff" | "owner" | "admin";

export type PharmUser = {
  name: string;
  role: PharmUserRole;
  canManageStock: boolean;
};

export const resolvePharmUser = (environment: Record<string, string | undefined>): PharmUser => {
  const configuredRole = environment.PHARM_USER_ROLE?.trim().toLowerCase();
  const role: PharmUserRole = configuredRole === "owner" || configuredRole === "admin"
    ? configuredRole
    : "staff";
  return {
    name: environment.PHARM_USER_NAME?.trim() || (role === "staff" ? "Pharmacy staff" : "Pharmacy owner"),
    role,
    canManageStock: role === "owner" || role === "admin",
  };
};

export const getCurrentPharmUser = () => resolvePharmUser(process.env);

export const requireStockManager = () => {
  const user = getCurrentPharmUser();
  if (!user.canManageStock) throw new Error("Purchase permission denied.");
  return user;
};
