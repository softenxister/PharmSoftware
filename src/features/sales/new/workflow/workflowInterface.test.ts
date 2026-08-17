import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflowSource = readFileSync(new URL("./useSaleWorkflow.ts", import.meta.url), "utf8");
const compositionSource = readFileSync(new URL("../NewSale.tsx", import.meta.url), "utf8");
const toolbarSource = readFileSync(new URL("./SaleToolbar.tsx", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../NewSale.module.css", import.meta.url), "utf8");
const settingsCatalogSource = readFileSync(new URL("../../../../i18n/catalog/settingsCatalog.ts", import.meta.url), "utf8");
const viewSources = [
  "SaleToolbar.tsx",
  "SaleCustomerField.tsx",
  "SaleItemEntry.tsx",
  "SaleCartTable.tsx",
  "SaleProductBrowser.tsx",
  "SaleSummaryBar.tsx",
  "SaleReminderPanel.tsx",
  "SaleSettingsDialog.tsx",
  "SalePaymentPanel.tsx",
  "SaleCompletionDialog.tsx",
].map((file) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8"));

test("the compact payment toggle labels Bank and gives Cash and Bank distinct hover states", () => {
  assert.match(toolbarSource, /paymentMethod === 'Cash' \? styles\.paymentMethodToggleCash : styles\.paymentMethodToggleBank/);
  assert.match(stylesSource, /\.paymentMethodToggleCash:hover/);
  assert.match(stylesSource, /\.paymentMethodToggleBank:hover/);
  assert.match(settingsCatalogSource, /"pos\.bankTransfer": "Bank",/);
});

test("Net Total opens a payment-method window before the invoice breakdown", () => {
  const salePageSource = readFileSync(new URL("../NewSale.tsx", import.meta.url), "utf8");

  assert.match(salePageSource, /SalePaymentMethodDialog/);
  assert.match(workflowSource, /openPaymentMethodSelection/);
  assert.match(workflowSource, /confirmPaymentMethodSelection/);
  assert.match(workflowSource, /openPaymentDrawer\(\)/);
  const shortcutHandler = workflowSource.match(/function handleSaleShortcut\([\s\S]*?\n  \}\n\n  useEffect/)?.[0] ?? '';
  assert.match(shortcutHandler, /if \(!discountOpen\) openPaymentMethodSelection\(\);/);
});

test("Sale views receive focused workflow projections instead of the complete workflow", () => {
  const projections = [
    "toolbar",
    "customerField",
    "itemEntry",
    "cartTable",
    "productBrowser",
    "summaryBar",
    "reminderPanel",
    "settingsDialog",
    "paymentPanel",
    "completionDialog",
  ];

  for (const projection of projections) {
    assert.match(compositionSource, new RegExp(`model=\\{workflow\\.${projection}\\}`));
  }
  assert.doesNotMatch(compositionSource, /sale=\{workflow\}/);
  for (const source of viewSources) {
    assert.doesNotMatch(source, /\{ sale \}: \{ sale: SaleWorkflow \}/);
  }
});

test("Sale workflow exposes cohesive areas without spreading internal hook state", () => {
  const interfaceBlock = workflowSource.match(
    /return \{\n([\s\S]*?)\n  \};\n\}\n\ntype SaleWorkflow/,
  )?.[1] ?? "";

  assert.ok(interfaceBlock, "Sale workflow interface return was not found");
  for (const projection of ["toolbar", "customerField", "itemEntry", "cartTable", "paymentPanel"]) {
    assert.match(interfaceBlock, new RegExp(`\\b${projection}:`));
  }
  assert.doesNotMatch(interfaceBlock, /\.\.\.(?:saleCatalog|saleCart|salePayment)/);
  assert.doesNotMatch(interfaceBlock, /(?:^|[,{}]\s*)set[A-Z]\w*\s*(?:[,}])/m);
  assert.doesNotMatch(workflowSource, /export type SaleWorkflow\b/);
});
