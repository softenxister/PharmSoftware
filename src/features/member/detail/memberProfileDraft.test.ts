import assert from "node:assert/strict";
import test from "node:test";
import {
  createMemberProfileDraft,
  isMemberProfileDraftUnchanged,
  serializeNewMemberProfileDraft,
  serializeMemberProfileDraft,
} from "./memberProfileDraft";

const memberProfile = {
  name: "Anong Srisuk",
  mobile: "0812345678",
  avatarUrl: "/api/member-avatar/m-1",
  allergies: [
    { id: "ingredient-1", canonicalName: "Penicillin" },
    { id: "ingredient-2", canonicalName: "Aspirin" },
  ],
};

test("a profile draft normalizes display fields without becoming dirty", () => {
  const draft = createMemberProfileDraft(memberProfile);

  assert.equal(draft.mobile, "081-234-5678");
  assert.equal(isMemberProfileDraftUnchanged(draft, memberProfile), true);
  assert.equal(
    isMemberProfileDraftUnchanged(
      { ...draft, selectedAllergies: [...draft.selectedAllergies].reverse() },
      memberProfile,
    ),
    true,
  );
});

test("profile serialization sends avatar changes only when explicitly edited", () => {
  const draft = createMemberProfileDraft(memberProfile);

  assert.deepEqual(serializeMemberProfileDraft("m-1", draft), {
    memberId: "m-1",
    name: "Anong Srisuk",
    mobile: "081-234-5678",
    allergyIngredientIds: ["ingredient-1", "ingredient-2"],
  });
  assert.deepEqual(
    serializeMemberProfileDraft("m-1", { ...draft, avatarUrl: null, avatarChanged: true }),
    {
      memberId: "m-1",
      name: "Anong Srisuk",
      mobile: "081-234-5678",
      avatarUrl: null,
      allergyIngredientIds: ["ingredient-1", "ingredient-2"],
    },
  );
});

test("new member serialization includes the selected photo and ingredient allergies", () => {
  const draft = createMemberProfileDraft({
    name: "",
    mobile: "",
    avatarUrl: null,
    allergies: [],
  });

  assert.deepEqual(serializeNewMemberProfileDraft({
    ...draft,
    name: "  Anong Srisuk  ",
    mobile: "081-234-5678",
    avatarUrl: "data:image/png;base64,iVBORw0KGgo=",
    avatarChanged: true,
    selectedAllergies: memberProfile.allergies,
  }), {
    name: "  Anong Srisuk  ",
    mobile: "081-234-5678",
    avatarUrl: "data:image/png;base64,iVBORw0KGgo=",
    allergyIngredientIds: ["ingredient-1", "ingredient-2"],
  });
});
