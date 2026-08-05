import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const cartSource = readFileSync(new URL('./useSaleCart.ts', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('./SaleItemEntry.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../NewSale.module.css', import.meta.url), 'utf8');

test('selecting an unpriced item fills and selects its full name in the search field', () => {
  assert.match(cartSource, /setItemQuery\(item\.name\)/);
  assert.match(cartSource, /itemSearchInputRef\.current\?\.focus\(\)/);
  assert.match(cartSource, /itemSearchInputRef\.current\?\.select\(\)/);
});

test('the zero-price warning is plain text beside the original-width search control', () => {
  assert.match(entrySource, /className=\{styles\.itemSearchControl\}/);
  assert.doesNotMatch(entrySource, /itemSearchInputWithWarning/);
  assert.match(entrySource, /<span aria-hidden="true">⚠<\/span>/);

  const searchControlRule = stylesSource.match(/\.itemSearchControl\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(searchControlRule, /width:\s*min\(100%,\s*760px\)/);
  assert.match(searchControlRule, /flex:\s*0 1 760px/);

  const warningRule = stylesSource.match(/\.itemSellPriceWarning\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.doesNotMatch(warningRule, /position:\s*absolute/);
  assert.doesNotMatch(warningRule, /(?:background|border|border-radius|padding|min-height):/);
  assert.match(warningRule, /color:\s*var\(--amber\)/);
});
