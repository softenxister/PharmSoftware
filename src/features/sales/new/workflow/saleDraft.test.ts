import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPayableSale, hasSellablePrice } from './saleDraft';

test('hasPayableSale requires at least one line and a positive finite net total', () => {
  assert.equal(hasPayableSale(0, 100), false);
  assert.equal(hasPayableSale(1, 0), false);
  assert.equal(hasPayableSale(1, Number.NaN), false);
  assert.equal(hasPayableSale(1, Number.POSITIVE_INFINITY), false);
  assert.equal(hasPayableSale(1, 0.01), true);
});

test('hasSellablePrice rejects zero and invalid resolved sell prices', () => {
  assert.equal(hasSellablePrice({ sellPrice: 0 }, { priceMultiplier: 1 }), false);
  assert.equal(hasSellablePrice({ sellPrice: 50 }, { priceMultiplier: 2, sellPriceThb: 0 }), false);
  assert.equal(hasSellablePrice({ sellPrice: Number.NaN }, { priceMultiplier: 1 }), false);
  assert.equal(hasSellablePrice({ sellPrice: 50 }, { priceMultiplier: 2 }), true);
});
