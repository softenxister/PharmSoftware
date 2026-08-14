import { formatThaiPhoneNumberList } from "@/lib/thaiPhoneNumber";
import type { IngredientOption } from "./memberProfileTypes";

export type MemberProfileSource = {
  name: string;
  mobile: string;
  avatarUrl?: string | null;
  allergies: IngredientOption[];
};

export type MemberProfileDraft = {
  name: string;
  mobile: string;
  avatarUrl: string | null;
  avatarChanged: boolean;
  selectedAllergies: IngredientOption[];
};

export type MemberProfileUpdate = {
  memberId: string;
  name: string;
  mobile: string;
  avatarUrl?: string | null;
  allergyIngredientIds: string[];
};

export type NewMemberProfile = Omit<MemberProfileUpdate, "memberId">;

export function createMemberProfileDraft(source: MemberProfileSource): MemberProfileDraft {
  return {
    name: source.name,
    mobile: formatThaiPhoneNumberList(source.mobile),
    avatarUrl: source.avatarUrl ?? null,
    avatarChanged: false,
    selectedAllergies: [...source.allergies],
  };
}

function allergyIdentity(allergies: IngredientOption[]): string {
  return allergies.map(({ id }) => id).sort().join("|");
}

export function isMemberProfileDraftUnchanged(
  draft: MemberProfileDraft,
  source: MemberProfileSource,
): boolean {
  return draft.name.trim() === source.name
    && formatThaiPhoneNumberList(draft.mobile) === formatThaiPhoneNumberList(source.mobile)
    && draft.avatarUrl === (source.avatarUrl ?? null)
    && allergyIdentity(draft.selectedAllergies) === allergyIdentity(source.allergies);
}

export function serializeMemberProfileDraft(
  memberId: string,
  draft: MemberProfileDraft,
): MemberProfileUpdate {
  return {
    memberId,
    name: draft.name,
    mobile: draft.mobile,
    ...(draft.avatarChanged ? { avatarUrl: draft.avatarUrl } : {}),
    allergyIngredientIds: draft.selectedAllergies.map(({ id }) => id),
  };
}

export function serializeNewMemberProfileDraft(
  draft: MemberProfileDraft,
): NewMemberProfile {
  return {
    name: draft.name,
    mobile: draft.mobile,
    ...(draft.avatarChanged ? { avatarUrl: draft.avatarUrl } : {}),
    allergyIngredientIds: draft.selectedAllergies.map(({ id }) => id),
  };
}
