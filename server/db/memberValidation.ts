import { formatThaiPhoneNumberList, isValidThaiPhoneNumberList } from "@/lib/thaiPhoneNumber";
import { validateAvatarDataUrl } from "@server/auth/accountValidation";

export type MemberProfileInput = {
  name: string;
  mobile: string;
  avatarUrl?: string | null;
  allergyIngredientIds?: string[];
};

export function parseMemberProfileInput(value: unknown): MemberProfileInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.name !== "string" || typeof candidate.mobile !== "string") return null;
  const rawAllergyIngredientIds = candidate.allergyIngredientIds;
  if (rawAllergyIngredientIds !== undefined && !Array.isArray(rawAllergyIngredientIds)) return null;
  const allergyValues = rawAllergyIngredientIds as unknown[] | undefined;
  let avatarUrl: string | null | undefined;
  if (candidate.avatarUrl !== undefined) {
    if (candidate.avatarUrl === null || candidate.avatarUrl === "") {
      avatarUrl = null;
    } else {
      avatarUrl = validateAvatarDataUrl(candidate.avatarUrl);
      if (!avatarUrl) return null;
    }
  }

  const name = candidate.name.trim();
  const mobile = candidate.mobile.trim();
  if (name.length < 2 || name.length > 100 || mobile.length > 200 || !isValidThaiPhoneNumberList(mobile)) return null;

  const allergyIngredientIds = allergyValues?.flatMap((value) => (
    typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200
      ? [value.trim()]
      : []
  ));
  if (allergyValues !== undefined && (
    allergyIngredientIds?.length !== allergyValues.length
    || new Set(allergyIngredientIds).size !== allergyIngredientIds.length
    || allergyIngredientIds.length > 50
  )) return null;

  return {
    name,
    mobile: formatThaiPhoneNumberList(mobile),
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    ...(allergyIngredientIds ? { allergyIngredientIds } : {}),
  };
}
