import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_DISTRIBUTOR_DATA_UPLOAD_BYTES,
  validateDistributorDataUpload,
} from "./distributorDataUpload";

test("distributor upload accepts original XLSX and UTF-8 CSV file names", () => {
  assert.equal(validateDistributorDataUpload({ name: "Spl_Items.xlsx", size: 47_730, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), null);
  assert.equal(validateDistributorDataUpload({ name: "Spl_Items.csv", size: 12_000, type: "text/csv" }), null);
});

test("distributor upload rejects unsupported, empty, and oversized files", () => {
  assert.match(validateDistributorDataUpload({ name: "Spl_Items.xls", size: 100, type: "application/vnd.ms-excel" }) ?? "", /xlsx or csv/i);
  assert.match(validateDistributorDataUpload({ name: "Spl_Items.xlsx", size: 0, type: "" }) ?? "", /empty/i);
  assert.match(validateDistributorDataUpload({ name: "Spl_Items.csv", size: MAX_DISTRIBUTOR_DATA_UPLOAD_BYTES + 1, type: "text/csv" }) ?? "", /5 MB/i);
});
