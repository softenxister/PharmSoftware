import assert from "node:assert/strict";
import test from "node:test";
import type { MemberDataImportRow } from "@server/import/memberDataMigration";
import {
  buildMemberImportWrite,
  MEMBER_DATA_MIGRATION_TRANSACTION_OPTIONS,
} from "./memberDataMigrationRepository";

const importedRow: MemberDataImportRow = {
  rowNumber: 2,
  memberCode: "C-26-1",
  name: "Member One",
  address: "12/50 Bangna",
  rawPhone: "925519995",
  phoneStatus: "valid",
  rawMembershipStartedAt: "20/03/2026",
  status: "update",
  matchedCustomerId: "member-existing",
  issue: null,
  warning: null,
  mobile: "092-551-9995",
  membershipStartedAt: new Date("2026-03-20T00:00:00.000Z"),
};

test("member import writes CSV profile fields but preserves internal state on updates", () => {
  const write = buildMemberImportWrite(importedRow, "member-new");

  assert.deepEqual(write.where, { memberCode: "C-26-1" });
  assert.deepEqual(write.update, {
    name: "Member One",
    mobile: "092-551-9995",
    address: "12/50 Bangna",
    isMember: true,
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
  });
  assert.equal("points" in write.update, false);
  assert.equal("membershipRank" in write.update, false);
  assert.deepEqual(write.create, {
    id: "member-new",
    memberCode: "C-26-1",
    name: "Member One",
    mobile: "092-551-9995",
    address: "12/50 Bangna",
    isMember: true,
    points: 0,
    membershipRank: "Bronze",
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
  });
});

test("member migration uses a serializable transaction with a bounded extended timeout", () => {
  assert.equal(MEMBER_DATA_MIGRATION_TRANSACTION_OPTIONS.isolationLevel, "Serializable");
  assert.ok((MEMBER_DATA_MIGRATION_TRANSACTION_OPTIONS.timeout ?? 0) >= 60_000);
});
