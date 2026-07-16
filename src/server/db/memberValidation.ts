export type MemberProfileInput = {
  name: string;
  mobile: string;
};

const MOBILE_PATTERN = /^\+?[0-9][0-9\s-]{7,19}$/;

export function parseMemberProfileInput(value: unknown): MemberProfileInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.name !== "string" || typeof candidate.mobile !== "string") return null;

  const name = candidate.name.trim();
  const mobile = candidate.mobile.trim();
  if (name.length < 2 || name.length > 100 || !MOBILE_PATTERN.test(mobile)) return null;
  return { name, mobile };
}
