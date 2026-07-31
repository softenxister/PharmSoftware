import assert from 'node:assert/strict';
import test from 'node:test';
import { persistRecentSale } from './salePersistence';
import { SAVED_SALES_KEY, type CartLine, type SavedSale } from './saleTypes';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

test('pending sale persistence keeps complete cart lines for reopening', () => {
  const storage = memoryStorage();
  const lines: CartLine[] = [{
    lineId: 'line-1',
    itemId: 'product-1',
    itemName: 'Paracetamol',
    packLabel: '10 / blister packs',
    packMultiplier: 1,
    unitPrice: 25,
    loc: 'A1',
    batch: {
      batchId: 'batch-1',
      batchNo: 'B-001',
      exp: '2028-01-31',
      sellPrice: 25,
      stock: 20,
    },
    qty: 2,
  }];

  persistRecentSale(storage, {
    id: 'pending-1',
    billNo: 'INV-PENDING-1',
    createdAt: '2026-07-31T10:00:00.000Z',
    customer: null,
    itemCount: 1,
    paymentMethod: 'Cash',
    purchaseMethod: 'pickup',
    netPayable: 50,
    status: 'pending',
    ownerId: 'o1',
    billDate: '2026-07-31',
    pharmacistId: 'p1',
    lines,
    discount: null,
    customerPaid: null,
    changeDue: 0,
  });

  const saved = JSON.parse(storage.getItem(SAVED_SALES_KEY) ?? '[]') as SavedSale[];
  assert.equal(saved[0]?.status, 'pending');
  assert.deepEqual(saved[0]?.lines, lines);
});
