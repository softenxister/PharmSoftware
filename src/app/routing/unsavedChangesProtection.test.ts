import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shouldBlockNavigation } from "../providers/UnsavedChangesProvider";

const topBarSource = readFileSync(new URL("../../components/navigation/TopBar.tsx", import.meta.url), "utf8");
const workflowSource = readFileSync(new URL("../../features/sales/new/workflow/useSaleWorkflow.ts", import.meta.url), "utf8");

test("dirty workflows block navigation to a different URL", () => {
  const current = { pathname: "/sales/new", search: "", hash: "" };
  assert.equal(shouldBlockNavigation(true, current, { pathname: "/settings", search: "", hash: "" }), true);
  assert.equal(shouldBlockNavigation(true, current, current), false);
  assert.equal(shouldBlockNavigation(false, current, { pathname: "/settings", search: "", hash: "" }), false);
});

test("New Sale registers its dirty cart and logout uses the guarded action path", () => {
  assert.match(workflowSource, /preferences\.confirmDestructiveActions && hasUnsavedSaleChanges && invoiceCreated === null/);
  assert.match(workflowSource, /navigateWithoutPrompt\(\(\) => navigate\('\/sales'\)\)/);
  assert.match(topBarSource, /const logout = \(\) => requestAction\(performLogout\)/);
});
