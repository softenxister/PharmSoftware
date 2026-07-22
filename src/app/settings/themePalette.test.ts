import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalsCss = readFileSync(new URL("../../styles/globals.css", import.meta.url), "utf8");
const invoiceStyles = [
  readFileSync(new URL("../sales/SalesHome.module.css", import.meta.url), "utf8"),
  readFileSync(new URL("../purchase/PurchaseHome.module.css", import.meta.url), "utf8"),
  readFileSync(new URL("../member/detail/MemberDetail.module.css", import.meta.url), "utf8"),
];
const newSaleStyles = readFileSync(new URL("../sales/new/NewSale.module.css", import.meta.url), "utf8");

const paletteTokens = [
  "--app-page",
  "--app-surface",
  "--app-surface-muted",
  "--app-surface-soft",
  "--app-border",
  "--app-border-soft",
  "--app-highlight-ink",
  "--app-icon-ink",
  "--app-action",
  "--app-action-dark",
  "--app-action-soft",
  "--app-create-action",
  "--app-create-action-dark",
  "--app-create-action-soft",
  "--app-ink",
  "--app-muted",
] as const;

const neutralSurfaceTokens = [
  "--app-page",
  "--app-surface",
  "--app-surface-muted",
  "--app-surface-soft",
  "--app-border",
  "--app-border-soft",
] as const;

const neutralTextTokens = [
  "--app-ink",
  "--app-muted",
  "--app-header-text",
  "--app-header-text-strong",
  "--app-header-text-soft",
] as const;

function declarationsFor(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = globalsCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));
  return match?.[1] ?? "";
}

test("every selectable theme defines the full application surface palette", () => {
  const selectors = [
    ":root",
    ':root[data-theme="pink"]',
    ':root[data-theme="orange"]',
    ':root[data-theme="purple"]',
  ];

  for (const selector of selectors) {
    const declarations = declarationsFor(selector);
    assert.ok(declarations, `missing palette declarations for ${selector}`);

    for (const token of paletteTokens) {
      assert.match(declarations, new RegExp(`${token}\\s*:`), `${selector} must define ${token}`);
    }
  }
});

test("interactive highlight colors remain distinct for every theme", () => {
  const selectors = [
    ":root",
    ':root[data-theme="pink"]',
    ':root[data-theme="orange"]',
    ':root[data-theme="purple"]',
  ];
  const highlightValues = selectors.map((selector) => {
    const declarations = declarationsFor(selector);
    const value = declarations.match(/--app-accent-soft\s*:\s*([^;]+)/)?.[1].trim();
    assert.ok(value, `${selector} must define --app-accent-soft`);
    return value;
  });

  assert.equal(new Set(highlightValues).size, selectors.length);
});

test("subtle surfaces and borders stay neutral grey in every color theme", () => {
  const selectors = [
    ":root",
    ':root[data-theme="pink"]',
    ':root[data-theme="orange"]',
    ':root[data-theme="purple"]',
  ];
  const valuesByToken = new Map<string, Set<string>>();

  for (const selector of selectors) {
    const declarations = declarationsFor(selector);
    for (const token of neutralSurfaceTokens) {
      const value = declarations.match(new RegExp(`${token}\\s*:\\s*([^;]+)`))?.[1].trim();
      assert.ok(value, `${selector} must define ${token}`);
      const values = valuesByToken.get(token) ?? new Set<string>();
      values.add(value);
      valuesByToken.set(token, values);
    }
  }

  for (const [token, values] of valuesByToken) {
    assert.equal(values.size, 1, `${token} should not be tinted by the selected theme`);
  }
});

test("application text stays neutral black and grey in every color theme", () => {
  const selectors = [
    ":root",
    ':root[data-theme="pink"]',
    ':root[data-theme="orange"]',
    ':root[data-theme="purple"]',
  ];
  const expected = {
    "--app-ink": "#202124",
    "--app-muted": "#6b7075",
    "--app-header-text": "#d5d9d6",
    "--app-header-text-strong": "#ffffff",
    "--app-header-text-soft": "#aeb5b0",
  } as const;

  for (const selector of selectors) {
    const declarations = declarationsFor(selector);
    for (const token of neutralTextTokens) {
      const value = declarations.match(new RegExp(`${token}\\s*:\\s*([^;]+)`))?.[1].trim();
      assert.equal(value, expected[token], `${selector} must keep ${token} neutral`);
    }
  }
});

test("dark highlights stay black instead of inheriting the selected theme", () => {
  const selectors = [
    ":root",
    ':root[data-theme="pink"]',
    ':root[data-theme="orange"]',
    ':root[data-theme="purple"]',
  ];

  for (const selector of selectors) {
    const declarations = declarationsFor(selector);
    const value = declarations.match(/--app-highlight-ink\s*:\s*([^;]+)/)?.[1].trim();
    assert.equal(value, "#111111", `${selector} must keep dark highlights black`);
  }
});

test("generic icons use a softer neutral grey in every theme", () => {
  const selectors = [
    ":root",
    ':root[data-theme="pink"]',
    ':root[data-theme="orange"]',
    ':root[data-theme="purple"]',
  ];

  for (const selector of selectors) {
    const declarations = declarationsFor(selector);
    const value = declarations.match(/--app-icon-ink\s*:\s*([^;]+)/)?.[1].trim();
    assert.equal(value, "#5f6368", `${selector} must keep generic icons soft grey`);
  }
});

test("workflow action buttons keep the pharmacy green palette in every theme", () => {
  const selectors = [
    ":root",
    ':root[data-theme="pink"]',
    ':root[data-theme="orange"]',
    ':root[data-theme="purple"]',
  ];
  const expected = {
    "--app-action": "#3f7d56",
    "--app-action-dark": "#356b49",
    "--app-action-soft": "#e8f3ec",
  } as const;

  for (const selector of selectors) {
    const declarations = declarationsFor(selector);
    for (const [token, expectedValue] of Object.entries(expected)) {
      const value = declarations.match(new RegExp(`${token}\\s*:\\s*([^;]+)`))?.[1].trim();
      assert.equal(value, expectedValue, `${selector} must keep ${token} pharmacy green`);
    }
  }
});

test("new create and submit actions keep a medium blue palette in every theme", () => {
  const selectors = [
    ":root",
    ':root[data-theme="pink"]',
    ':root[data-theme="orange"]',
    ':root[data-theme="purple"]',
  ];
  const expected = {
    "--app-create-action": "#3f78a0",
    "--app-create-action-dark": "#35678a",
    "--app-create-action-soft": "#e9f1f6",
  } as const;

  for (const selector of selectors) {
    const declarations = declarationsFor(selector);
    for (const [token, expectedValue] of Object.entries(expected)) {
      const value = declarations.match(new RegExp(`${token}\\s*:\\s*([^;]+)`))?.[1].trim();
      assert.equal(value, expectedValue, `${selector} must keep ${token} medium blue`);
    }
  }
});

test("invoice identifiers use the neutral dark highlight", () => {
  for (const stylesheet of invoiceStyles) {
    const billNumberRule = stylesheet.match(/^\.billNo\s*\{([^}]+)\}/m)?.[1] ?? "";
    assert.match(billNumberRule, /color\s*:\s*var\(--app-highlight-ink\)/);
  }

  const createdInvoiceNumberRule = newSaleStyles.match(/^\.invoiceCreatedRow \.invoiceCreatedNo\s*\{([^}]+)\}/m)?.[1] ?? "";
  assert.match(createdInvoiceNumberRule, /color\s*:\s*var\(--app-highlight-ink\)/);
});
