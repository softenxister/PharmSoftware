import assert from "node:assert/strict";
import test from "node:test";
import { validateCustomerPurchaseHistoryUpload } from "./customerPurchaseHistoryUpload";

test("customer purchase history upload accepts non-empty XLSX reports within 5 MB", () => {
  assert.equal(validateCustomerPurchaseHistoryUpload({
    name: "Rep_CustBuy_Det.xlsx",
    size: 640_000,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }), null);
});

test("customer purchase history upload rejects wrong extensions, empty files, and oversized files", () => {
  assert.match(validateCustomerPurchaseHistoryUpload({ name: "report.csv", size: 5, type: "text/csv" }) ?? "", /XLSX/);
  assert.match(validateCustomerPurchaseHistoryUpload({ name: "report.xlsx", size: 0, type: "" }) ?? "", /empty/);
  assert.match(validateCustomerPurchaseHistoryUpload({ name: "report.xlsx", size: 6 * 1024 * 1024, type: "" }) ?? "", /5 MB/);
});
