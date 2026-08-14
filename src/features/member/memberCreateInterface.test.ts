import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const directorySource = readFileSync(new URL("./MemberDirectory.tsx", import.meta.url), "utf8");
const dialogSource = readFileSync(new URL("./detail/MemberProfileDialog.tsx", import.meta.url), "utf8");
const createHookSource = readFileSync(new URL("./useMemberCreate.ts", import.meta.url), "utf8");

test("member creation reuses the profile editor with photo upload support", () => {
  assert.match(directorySource, /<MemberProfileDialog[\s\S]*mode="create"/);
  assert.match(directorySource, /searchParams\.get\("create"\) === "1"/);
  assert.match(dialogSource, /type="file"/);
  assert.match(dialogSource, /editor\.chooseAvatar/);
  assert.match(createHookSource, /method: "POST"/);
  assert.match(createHookSource, /serializeNewMemberProfileDraft/);
});
