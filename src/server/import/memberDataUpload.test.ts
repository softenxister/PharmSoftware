import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeUtf8MemberDataUpload,
  validateMemberDataUpload,
} from "./memberDataUpload";

test("member upload accepts a non-empty CSV file", () => {
  assert.equal(validateMemberDataUpload({ name: "members.csv", size: 420, type: "text/csv" }), null);
});

test("member upload rejects unsupported, empty, and oversized files", () => {
  assert.match(validateMemberDataUpload({ name: "members.xlsx", size: 420, type: "application/vnd.ms-excel" }) ?? "", /CSV/i);
  assert.match(validateMemberDataUpload({ name: "members.csv", size: 0, type: "text/csv" }) ?? "", /empty/i);
  assert.match(validateMemberDataUpload({ name: "members.csv", size: 5 * 1024 * 1024 + 1, type: "text/csv" }) ?? "", /5 MB/i);
});

test("member upload decodes UTF-8 with or without a BOM", () => {
  const source = "รหัสสมาชิก,ชื่อ-สกุล\nC-1,เจน";
  const utf8 = new TextEncoder().encode(source);

  assert.equal(decodeUtf8MemberDataUpload(utf8), source);
  assert.equal(decodeUtf8MemberDataUpload(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8])), source);
});

test("member upload rejects bytes that are not valid UTF-8", () => {
  assert.throws(() => decodeUtf8MemberDataUpload(Uint8Array.of(0x80)), /UTF-8/i);
});
