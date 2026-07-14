const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;
const PHONE_PATTERN = /^[0-9+() .-]*$/;
const MAX_AVATAR_BYTES = 512 * 1024;

export type OwnerSetupInput = {
  name: string;
  username: string;
  phone: string;
  password: string;
};

export type LoginInput = {
  username: string;
  password: string;
};

export type StaffCreateInput = {
  name: string;
  username: string;
  phone: string;
  pharmacistLicenseNumber: string;
  password: string;
};

export type AccountProfileUpdate = {
  name: string;
  username: string;
  phone: string;
  pharmacistLicenseNumber: string;
  avatarUrl: string | null;
};

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type StaffActionInput =
  | {
    staffId: string;
    action: "set-active";
    isActive: boolean;
  }
  | {
    staffId: string;
    action: "reset-password";
    password: string;
  };

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const cleanText = (value: unknown, min: number, max: number): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length < min || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) return null;
  return text;
};

const cleanOptionalText = (value: unknown, max: number): string | null => {
  if (value === undefined || value === null || value === "") return "";
  return cleanText(value, 1, max);
};

const cleanUsername = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const username = value.trim().toLocaleLowerCase("en-US");
  return USERNAME_PATTERN.test(username) ? username : null;
};

const cleanPhone = (value: unknown): string | null => {
  const phone = cleanOptionalText(value, 30);
  return phone !== null && PHONE_PATTERN.test(phone) ? phone : null;
};

const cleanPassword = (value: unknown): string | null => (
  typeof value === "string" && value.length >= 10 && value.length <= 128
    ? value
    : null
);

const hasImageSignature = (mimeType: string, bytes: Buffer): boolean => {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString("ascii") === "RIFF"
      && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
};

export function validateAvatarDataUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 700_000) return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES || !hasImageSignature(match[1], bytes)) return null;
  return value;
}

export function parseOwnerSetupInput(value: unknown): OwnerSetupInput | null {
  const input = asRecord(value);
  if (!input) return null;
  const name = cleanText(input.name, 2, 100);
  const username = cleanUsername(input.username);
  const phone = cleanPhone(input.phone);
  const password = cleanPassword(input.password);
  if (!name || !username || phone === null || !password) return null;
  return { name, username, phone, password };
}

export function parseLoginInput(value: unknown): LoginInput | null {
  const input = asRecord(value);
  if (!input) return null;
  const username = cleanUsername(input.username);
  const password = typeof input.password === "string" && input.password.length <= 128
    ? input.password
    : null;
  if (!username || !password) return null;
  return { username, password };
}

export function parseStaffCreateInput(value: unknown): StaffCreateInput | null {
  const input = asRecord(value);
  if (!input) return null;
  const name = cleanText(input.name, 2, 100);
  const username = cleanUsername(input.username);
  const phone = cleanPhone(input.phone);
  const pharmacistLicenseNumber = cleanOptionalText(input.pharmacistLicenseNumber, 80);
  const password = cleanPassword(input.password);
  if (!name || !username || phone === null || pharmacistLicenseNumber === null || !password) return null;
  return { name, username, phone, pharmacistLicenseNumber, password };
}

export function parseAccountProfileUpdate(value: unknown): AccountProfileUpdate | null {
  const input = asRecord(value);
  if (!input) return null;
  const name = cleanText(input.name, 2, 100);
  const username = cleanUsername(input.username);
  const phone = cleanPhone(input.phone);
  const pharmacistLicenseNumber = cleanOptionalText(input.pharmacistLicenseNumber, 80);
  const avatarUrl = input.avatarUrl === null || input.avatarUrl === ""
    ? null
    : validateAvatarDataUrl(input.avatarUrl);
  if (!name || !username || phone === null || pharmacistLicenseNumber === null || (input.avatarUrl && !avatarUrl)) return null;
  return { name, username, phone, pharmacistLicenseNumber, avatarUrl };
}

export function parsePasswordChangeInput(
  value: unknown,
  requireCurrentPassword: boolean,
): PasswordChangeInput | null {
  const input = asRecord(value);
  if (!input) return null;

  const currentPassword = typeof input.currentPassword === "string"
    && input.currentPassword.length > 0
    && input.currentPassword.length <= 128
    ? input.currentPassword
    : "";
  const newPassword = cleanPassword(input.newPassword);

  if (!newPassword || (requireCurrentPassword && !currentPassword)) return null;
  return { currentPassword, newPassword };
}

export function parseStaffActionInput(value: unknown): StaffActionInput | null {
  const input = asRecord(value);
  if (!input) return null;
  const staffId = cleanText(input.staffId, 1, 100);
  if (!staffId) return null;

  if (input.action === "set-active" && typeof input.isActive === "boolean") {
    return { staffId, action: "set-active", isActive: input.isActive };
  }

  if (input.action === "reset-password") {
    const password = cleanPassword(input.password);
    return password ? { staffId, action: "reset-password", password } : null;
  }

  return null;
}
