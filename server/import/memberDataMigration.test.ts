import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMemberDataMigrationPreview,
  normalizeImportedMemberPhone,
  prepareMemberDataMigration,
  type ExistingCustomerIdentity,
} from "./memberDataMigration";

const headers = "ลำดับ,Active,บาร์โค้ด,รหัสสมาชิก,ชื่อ-สกุล,ที่อยู่,โทรศัพท์,เริ่มเป็นสมาชิก,คะแนนขายปลีก,คะแนนขายส่ง";

function csv(...rows: string[]): string {
  return [headers, ...rows].join("\n");
}

function existing(overrides: Partial<ExistingCustomerIdentity> = {}): ExistingCustomerIdentity {
  return {
    id: "member-existing",
    memberCode: "C-25-21",
    mobile: "064-349-0581",
    ...overrides,
  };
}

test("member preview maps only supported columns and preserves exact source phone text", () => {
  const prepared = prepareMemberDataMigration(csv(
    '1,TRUE,2.53984E+12,C-25-21,Jack,"12/50 Bangna, Bangkok", 925519995 ,04/07/2025,12,0',
    "2,FALSE,ignored,C-25-61,เจน,,invalid phone,07/11/2025,9,3",
  ), [existing()]);

  assert.deepEqual(prepared.preview.summary, {
    totalRows: 2,
    newCount: 1,
    updateCount: 1,
    conflictCount: 0,
    phoneNullCount: 1,
  });
  assert.equal(prepared.preview.rows[0].status, "update");
  assert.equal(prepared.preview.rows[0].rawPhone, " 925519995 ");
  assert.equal(prepared.preview.rows[0].address, "12/50 Bangna, Bangkok");
  assert.equal(prepared.preview.rows[0].rawMembershipStartedAt, "04/07/2025");
  assert.equal(prepared.importRows[0].mobile, "092-551-9995");
  assert.equal(prepared.preview.rows[1].phoneStatus, "invalid");
  assert.equal(prepared.importRows[1].mobile, null);
});

test("member phone normalization restores Thai local forms and nulls invalid values", () => {
  assert.equal(normalizeImportedMemberPhone("095-8382352,081-4362858"), "095-838-2352,081-436-2858");
  assert.equal(normalizeImportedMemberPhone("29926587"), "02-992-6587");
  assert.equal(normalizeImportedMemberPhone("925519995"), "092-551-9995");
  assert.equal(normalizeImportedMemberPhone("66812345678"), "081-234-5678");
  assert.equal(normalizeImportedMemberPhone("6621234567"), "02-123-4567");
  assert.equal(normalizeImportedMemberPhone("02-385-8364"), "02-385-8364");
  assert.equal(normalizeImportedMemberPhone("081 234 5678"), "081-234-5678");
  assert.equal(normalizeImportedMemberPhone("0712345678"), null);
  assert.equal(normalizeImportedMemberPhone("081ABC2345678"), null);
  assert.equal(normalizeImportedMemberPhone(""), null);
});

test("member preview preserves an exact quoted multi-phone source value", () => {
  const prepared = prepareMemberDataMigration(csv(
    '1,TRUE,ignored,C-26-25,Company,,"095-8382352,081-4362858",04/07/2026,0,0',
  ), []);

  assert.equal(prepared.preview.rows[0].rawPhone, "095-8382352,081-4362858");
  assert.equal(prepared.preview.rows[0].phoneStatus, "valid");
  assert.equal(prepared.importRows[0].mobile, "095-838-2352,081-436-2858");
});

test("duplicate phones produce warnings without blocking uploaded rows", () => {
  const preview = buildMemberDataMigrationPreview(csv(
    '1,TRUE,ignored,C-26-1,One,,"095-8382352,081-4362858",20/03/2026,0,0',
    "2,TRUE,ignored,C-26-2,Two,,0814362858,21/03/2026,0,0",
  ), [existing({ memberCode: "OTHER", mobile: "092-551-9995" })]);

  assert.equal(preview.summary.conflictCount, 0);
  assert.deepEqual(preview.rows.map((row) => row.status), ["new", "new"]);
  assert.deepEqual(preview.rows.map((row) => row.issue), [null, null]);
  assert.match(preview.rows[0].warning ?? "", /duplicate phone.*081-436-2858/i);
  assert.match(preview.rows[1].warning ?? "", /duplicate phone.*081-436-2858/i);
});

test("a phone already used by another customer produces a non-blocking warning", () => {
  const preview = buildMemberDataMigrationPreview(csv(
    "1,TRUE,ignored,C-26-1,One,,925519995,20/03/2026,0,0",
  ), [existing({ memberCode: "OTHER", mobile: "092-551-9995" })]);

  assert.equal(preview.rows[0].status, "new");
  assert.equal(preview.rows[0].issue, null);
  assert.match(preview.rows[0].warning ?? "", /duplicate phone.*092-551-9995/i);
});

test("duplicate uploaded member codes block every affected row even when phones repeat", () => {
  const preview = buildMemberDataMigrationPreview(csv(
    "1,TRUE,ignored,C-26-1,One,,0812345678,20/03/2026,0,0",
    "2,TRUE,ignored,C-26-1,Two,,0899999999,21/03/2026,0,0",
    "3,TRUE,ignored,C-26-3,Three,,0812345678,22/03/2026,0,0",
  ), []);

  assert.deepEqual(preview.rows.map((row) => row.status), ["conflict", "conflict", "new"]);
  assert.match(preview.rows[0].issue ?? "", /duplicate member code/i);
  assert.equal(preview.rows[2].issue, null);
  assert.match(preview.rows[0].warning ?? "", /duplicate phone/i);
  assert.match(preview.rows[2].warning ?? "", /duplicate phone/i);
});

test("missing required values and invalid membership dates block rows", () => {
  const preview = buildMemberDataMigrationPreview(csv(
    "1,TRUE,ignored,,Missing code,,,20/03/2026,0,0",
    "2,TRUE,ignored,C-26-2,,,,20/03/2026,0,0",
    "3,TRUE,ignored,C-26-3,Bad date,,,31/02/2026,0,0",
    "4,TRUE,ignored,C-26-4,Missing date,,,,0,0",
  ), []);

  assert.equal(preview.summary.conflictCount, 4);
  assert.match(preview.rows[0].issue ?? "", /member code/i);
  assert.match(preview.rows[1].issue ?? "", /name/i);
  assert.match(preview.rows[2].issue ?? "", /date/i);
  assert.match(preview.rows[3].issue ?? "", /date/i);
});

test("member preview requires the supported CSV headers", () => {
  assert.throws(
    () => buildMemberDataMigrationPreview("รหัสสมาชิก,ชื่อ-สกุล\nC-1,Name", []),
    /missing required columns/i,
  );
});

test("member confirmation token changes with file or reconciliation state", () => {
  const source = csv("1,TRUE,ignored,C-26-1,One,,925519995,20/03/2026,0,0");
  const first = buildMemberDataMigrationPreview(source, []);
  const same = buildMemberDataMigrationPreview(source, []);
  const update = buildMemberDataMigrationPreview(source, [existing({
    memberCode: "C-26-1",
    mobile: "089-111-2222",
  })]);

  assert.equal(first.confirmationToken, same.confirmationToken);
  assert.notEqual(first.confirmationToken, update.confirmationToken);
});
