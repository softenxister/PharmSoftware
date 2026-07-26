export type PharmUserRole = "owner" | "pharmacist";

export type PharmUser = {
  id: string;
  name: string;
  username: string;
  phone: string;
  pharmacistLicenseNumber: string | null;
  avatarUrl: string | null;
  role: PharmUserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  canManageStock: boolean;
};

export type PharmAccountRecord = Omit<PharmUser, "canManageStock"> & {
  passwordHash?: string;
};

export const toPharmUser = (account: PharmAccountRecord): PharmUser => ({
  id: account.id,
  name: account.name,
  username: account.username,
  phone: account.phone,
  pharmacistLicenseNumber: account.pharmacistLicenseNumber,
  avatarUrl: account.avatarUrl,
  role: account.role,
  isActive: account.isActive,
  mustChangePassword: account.mustChangePassword,
  canManageStock: account.role === "owner",
});

export async function getCurrentPharmAccount(): Promise<PrivatePharmAccount | null> {
  const token = getRequestCookie(AUTH_SESSION_COOKIE);
  if (!token) return null;
  try {
    return await readAccountBySessionHash(hashSessionToken(token));
  } catch {
    return null;
  }
}

export async function getCurrentPharmUser(): Promise<PharmUser | null> {
  const account = await getCurrentPharmAccount();
  return account ? toPharmUser(account) : null;
}

export const canManageStoreSettings = (user: PharmUser) => user.role === "owner";

export const canManageStaff = (user: PharmUser) => user.role === "owner";

export const isAuthenticationError = (error: unknown): error is Error => (
  error instanceof Error
  && (error.message === "Authentication required." || error.message === "Password change required.")
);

export const requireAuthenticatedUser = async () => {
  const user = await getCurrentPharmUser();
  if (!user) throw new Error("Authentication required.");
  if (user.mustChangePassword) throw new Error("Password change required.");
  return user;
};

export const requireStoreOwner = async () => {
  const user = await requireAuthenticatedUser();
  if (!canManageStoreSettings(user)) throw new Error("Store settings permission denied.");
  return user;
};

export const requireStockManager = async () => {
  const user = await requireAuthenticatedUser();
  if (!user.canManageStock) throw new Error("Purchase permission denied.");
  return user;
};
import { readAccountBySessionHash, type PrivatePharmAccount } from "@server/db/authRepository";
import { getRequestCookie } from "./requestContext";
import { AUTH_SESSION_COOKIE, hashSessionToken } from "./sessionToken";
