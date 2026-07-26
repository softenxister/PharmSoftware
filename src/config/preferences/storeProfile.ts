export const STORE_PROFILE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_STORE_PROFILE_IMAGE_BYTES = 1024 * 1024;

export type StoreProfile = {
  storeName: string;
  phone: string;
  email: string;
  taxId: string;
  pharmacyLicense: string;
  address: string;
  lineId: string;
  facebookPage: string;
  openingTime: string;
  closingTime: string;
  imageUrl: string | null;
};

export const EMPTY_STORE_PROFILE: Readonly<StoreProfile> = Object.freeze({
  storeName: "",
  phone: "",
  email: "",
  taxId: "",
  pharmacyLicense: "",
  address: "",
  lineId: "",
  facebookPage: "",
  openingTime: "",
  closingTime: "",
  imageUrl: null,
});

const FIELD_LIMITS: Record<Exclude<keyof StoreProfile, "imageUrl">, number> = {
  storeName: 120,
  phone: 40,
  email: 160,
  taxId: 40,
  pharmacyLicense: 100,
  address: 500,
  lineId: 100,
  facebookPage: 240,
  openingTime: 5,
  closingTime: 5,
};

const validEmail = (value: string) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function parseStoreProfileUpdate(value: unknown): StoreProfile | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const profile = { ...EMPTY_STORE_PROFILE } as StoreProfile;
  for (const [field, limit] of Object.entries(FIELD_LIMITS) as Array<[keyof typeof FIELD_LIMITS, number]>) {
    if (typeof candidate[field] !== "string") return null;
    const normalized = candidate[field].trim();
    if (normalized.length > limit) return null;
    profile[field] = normalized;
  }
  const validTime = (time: string) => time === "" || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!profile.storeName || !validEmail(profile.email) || !validTime(profile.openingTime) || !validTime(profile.closingTime)) return null;
  return profile;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]) => (
  bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)
);

export function validateStoreProfileImage(bytes: Uint8Array, contentType: string): string | null {
  if (bytes.byteLength === 0) return "Choose a non-empty image.";
  if (bytes.byteLength > MAX_STORE_PROFILE_IMAGE_BYTES) return "Image must be 1 MB or smaller.";
  if (!STORE_PROFILE_IMAGE_TYPES.includes(contentType as typeof STORE_PROFILE_IMAGE_TYPES[number])) {
    return "Choose a PNG, JPEG, or WebP image.";
  }
  const matches = contentType === "image/png"
    ? startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : contentType === "image/jpeg"
      ? startsWith(bytes, [0xff, 0xd8, 0xff])
      : startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
  return matches ? null : "Image content does not match its file type.";
}
