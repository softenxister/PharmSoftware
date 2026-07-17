export const MEMBER_AVATAR_MAX_BYTES = 512 * 1024;

const MEMBER_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isAllowedMemberAvatarFile(file: { type: string; size: number }): boolean {
  return MEMBER_AVATAR_MIME_TYPES.has(file.type)
    && file.size > 0
    && file.size <= MEMBER_AVATAR_MAX_BYTES;
}

export function decodeMemberAvatarDataUrl(value: string): { contentType: string; bytes: Uint8Array } | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  try {
    const decoded = atob(match[2]);
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    if (bytes.length === 0 || bytes.length > MEMBER_AVATAR_MAX_BYTES) return null;
    return { contentType: match[1], bytes };
  } catch {
    return null;
  }
}
