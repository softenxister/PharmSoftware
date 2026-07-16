export const MEMBER_AVATAR_MAX_BYTES = 512 * 1024;

const MEMBER_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isAllowedMemberAvatarFile(file: { type: string; size: number }): boolean {
  return MEMBER_AVATAR_MIME_TYPES.has(file.type)
    && file.size > 0
    && file.size <= MEMBER_AVATAR_MAX_BYTES;
}
