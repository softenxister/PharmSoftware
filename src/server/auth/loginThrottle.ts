import { createHash } from "node:crypto";

export const LOGIN_MAX_ATTEMPTS = 8;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type LoginThrottleRecord = {
  attempts: number;
  windowStartedAt: Date;
};

export type LoginThrottleStatus = {
  blocked: boolean;
  retryAfterSeconds: number;
};

export function hashLoginThrottleKey(username: string): string {
  return createHash("sha256")
    .update(username.trim().toLocaleLowerCase("en-US"))
    .digest("hex");
}

export function getLoginThrottleStatus(
  record: LoginThrottleRecord | null,
  now: Date = new Date(),
): LoginThrottleStatus {
  if (!record) return { blocked: false, retryAfterSeconds: 0 };

  const elapsed = now.getTime() - record.windowStartedAt.getTime();
  if (elapsed < 0 || elapsed >= LOGIN_WINDOW_MS || record.attempts < LOGIN_MAX_ATTEMPTS) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((LOGIN_WINDOW_MS - elapsed) / 1000)),
  };
}
