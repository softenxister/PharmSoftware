export type LoginMode = "login" | "setup";

export const INITIAL_LOGIN_MODE: LoginMode = "login";

export function resolveOwnerSetupMode(setupRequired: boolean): LoginMode {
  return setupRequired ? "setup" : "login";
}
