import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDate,
  formatMoney,
  translate,
} from "./i18n";
import { findCatalogPlaceholderMismatches } from "./catalog/assembleCatalog";

test("localized catalog entries preserve their interpolation contract", () => {
  assert.deepEqual(findCatalogPlaceholderMismatches(), []);
});

test("Thai navigation copy stays compact", () => {
  assert.equal(translate("th", "nav.dashboard"), "ภาพรวม");
  assert.equal(translate("th", "nav.newSale"), "ขายใหม่");
  assert.ok(translate("th", "nav.settings").length <= "Settings".length);
});

test("Thai counter actions stay close to their English control length", () => {
  const compactKeys = [
    "newSale.save",
    "newSale.add",
    "newSale.submit",
    "purchaseEntry.saveDraft",
    "stock.applyFilter",
    "staff.activate",
  ] as const;

  for (const key of compactKeys) {
    const english = translate("en", key);
    const thai = translate("th", key);
    assert.ok(thai.length <= english.length + 6, `${key} is too long for its existing control`);
  }
});

test("missing Thai copy falls back to English", () => {
  assert.equal(translate("th", "common.notConfigured"), "Not configured");
});

test("Thai dates remain Gregorian and money remains Thai baht", () => {
  const date = formatDate("th", new Date("2026-07-15T03:00:00.000Z"), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  assert.match(date, /2026/);
  assert.match(formatMoney("th", 1234.5), /1,234\.50/);
});

test("stock adjustment helper text is translated", () => {
  assert.equal(
    translate("th", "stock.adjustmentFilterNote"),
    "สถานะการปรับยังไม่ใช้กรองตารางสินค้า",
  );
});

test("color themes use descriptive names in both languages", () => {
  const themeKeys = [
    "appearance.pharmacyGreen",
    "appearance.pink",
    "appearance.orange",
    "appearance.purple",
  ] as const;

  assert.deepEqual(
    themeKeys.map((key) => translate("en", key)),
    ["Pharmacy Green", "Rose Pink", "Warm Orange", "Calm Purple"],
  );
  assert.deepEqual(
    themeKeys.map((key) => translate("th", key)),
    ["เขียวเภสัช", "ชมพูกุหลาบ", "ส้มอบอุ่น", "ม่วงสงบ"],
  );
});

test("product image storage failures have localized log copy", () => {
  assert.equal(
    translate("en", "productImages.failureLogTitle", { count: 6 }),
    "6 items could not be stored",
  );
  assert.equal(
    translate("th", "productImages.failureLogTitle", { count: 6 }),
    "จัดเก็บไม่สำเร็จ 6 รายการ",
  );
});
