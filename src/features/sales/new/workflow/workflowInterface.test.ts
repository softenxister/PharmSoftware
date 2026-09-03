import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflowSource = readFileSync(new URL("./useSaleWorkflow.ts", import.meta.url), "utf8");
const compositionSource = readFileSync(new URL("../NewSale.tsx", import.meta.url), "utf8");
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
const toolbarSource = readFileSync(new URL("./SaleToolbar.tsx", import.meta.url), "utf8");

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

test("Net total can skip the payment method dialog when the account preference is off", () => {
  assert.match(
    workflowSource,
    /if \(preferences\.showPaymentMethodAfterNetTotal\) \{[\s\S]*?setPaymentMethodDialogOpen\(true\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?openPaymentDrawer\(\);/,
  );
});

test("an opened pending bill exposes a whole-bill delete action", () => {
  assert.match(toolbarSource, /canDeleteBill &&/);
  assert.match(toolbarSource, /onClick=\{requestDeleteBill\}/);
  assert.match(workflowSource, /await pendingSale\.remove\(\)/);
  assert.match(workflowSource, /navigateWithoutPrompt\(\(\) => navigate\('\/sales\/new'\)\)/);
  assert.match(workflowSource, /removesLastPendingLine[\s\S]*?requestDeletePendingBill\(\)/);
});

test("Pending Sale state is delegated through the lifecycle interface", () => {
  assert.match(workflowSource, /usePendingSaleLifecycle\(/);
  assert.match(workflowSource, /pendingSale\.hasMeaningfulChanges\(currentPendingSaleDraft\)/);
  assert.match(workflowSource, /pendingSale\.save\(currentPendingSaleDraft/);
  assert.doesNotMatch(workflowSource, /pendingSaleDraftSignature|SAVED_SALES_KEY|localStorage/);
});

test("the leave dialog offers discard on the left and save-and-leave on the right", () => {
  assert.match(workflowSource, /: 'newSale\.leaveSale'/);
  assert.match(workflowSource, /: 'newSale\.saveAndLeave'/);
  assert.match(workflowSource, /: leaveWithoutSaving/);
  assert.match(workflowSource, /: \(\) => void saveAndLeave\(\)/);
  assert.match(workflowSource, /if \(saved\) unsavedSaleNavigation\.confirmNavigation\(\)/);
});
