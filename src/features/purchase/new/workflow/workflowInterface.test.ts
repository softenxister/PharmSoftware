import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflowSource = readFileSync(new URL("./usePurchaseWorkflow.ts", import.meta.url), "utf8");
const compositionSource = readFileSync(new URL("../PurchaseEntry.tsx", import.meta.url), "utf8");
const viewSources = [
  "PurchaseDetailsPanel.tsx",
  "PurchaseItemSearch.tsx",
  "PurchaseLineEditor.tsx",
  "PurchaseLineTable.tsx",
].map((file) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8"));
viewSources.push(
  readFileSync(new URL("../PurchaseWorkflowBar.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("../PurchaseCorrectionDialog.tsx", import.meta.url), "utf8"),
);

test("Purchase views receive focused workflow projections instead of the complete workflow", () => {
  for (const projection of ["details", "itemSearch", "lines", "lineEditor", "workflowBar", "correctionDialog"]) {
    assert.match(compositionSource, new RegExp(`model=\\{workflow\\.${projection}\\}`));
  }
  assert.doesNotMatch(compositionSource, /workflow=\{workflow\}/);
  for (const source of viewSources) {
    assert.doesNotMatch(source, /\{ workflow \}: \{ workflow: PurchaseWorkflow \}/);
  }
});

test("Purchase workflow exposes cohesive areas without raw state setters", () => {
  const interfaceBlock = workflowSource.match(
    /return \{\n([\s\S]*?)\n  \};\n\}\n\ntype PurchaseWorkflow/,
  )?.[1] ?? "";

  assert.ok(interfaceBlock, "Purchase workflow interface return was not found");
  for (const projection of ["header", "details", "itemSearch", "lines", "lineEditor", "workflowBar", "correctionDialog"]) {
    assert.match(interfaceBlock, new RegExp(`\\b${projection}:`));
  }
  assert.doesNotMatch(interfaceBlock, /(?:^|[,{}]\s*)set[A-Z]\w*\s*(?:[,}])/m);
  assert.doesNotMatch(workflowSource, /export type PurchaseWorkflow\b/);
});
