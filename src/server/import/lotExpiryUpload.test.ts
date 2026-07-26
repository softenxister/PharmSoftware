import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_LOT_EXPIRY_UPLOAD_BYTES,
  validateLotExpiryUpload,
} from "./lotExpiryUpload";

test("lot and expiry upload accepts a bounded XLSX workbook", () => {
  assert.equal(validateLotExpiryUpload({
    name: "StockBal_MfgExp.xlsx",
    size: 704 * 1024,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }), null);
});

test("lot and expiry upload rejects other extensions, empty files, and oversized files", () => {
  assert.match(validateLotExpiryUpload({
    name: "StockBal_MfgExp.csv",
    size: 100,
    type: "text/csv",
  }) ?? "", /XLSX/i);
  assert.match(validateLotExpiryUpload({
    name: "StockBal_MfgExp.xlsx",
    size: 0,
    type: "",
  }) ?? "", /empty/i);
  assert.match(validateLotExpiryUpload({
    name: "StockBal_MfgExp.xlsx",
    size: MAX_LOT_EXPIRY_UPLOAD_BYTES + 1,
    type: "",
  }) ?? "", /5 MB/i);
});
