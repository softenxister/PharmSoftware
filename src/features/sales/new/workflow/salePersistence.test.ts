import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHttpPendingSaleAdapter,
  loadPendingSale,
  postSale,
} from './salePersistence';
import type { Customer, SavedSale, SaleWriteRequest } from './saleTypes';

const request: SaleWriteRequest = {
  status: 'pending',
  owner: { id: 'o1', name: 'Owner' },
  pharmacist: { id: 'p1', name: 'Pharmacist' },
  customer: null,
  paymentMethod: 'Cash',
  purchaseMethod: 'pickup',
  billDate: '2026-09-03',
  subtotal: 50,
  netPayable: 50,
  customerPaid: null,
  changeDue: 0,
  discount: null,
  lines: [{
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
  }],
};

test('saving a Pending Sale sends the complete durable bill to the API', async () => {
  let postedBody: unknown;
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    postedBody = JSON.parse(String(init?.body));
    return Response.json({
      sale: { id: 'pending-1', billNo: 'INV-1', date: '2026-09-03T00:00:00.000Z', status: 'pending' },
    });
  };

  const sale = await postSale(request, fetcher as typeof fetch);

  assert.equal(sale.id, 'pending-1');
  assert.deepEqual(postedBody, request);
});

test('the HTTP adapter maps stale saves to a lifecycle conflict', async () => {
  const fetcher = async () => Response.json({
    error: 'This Pending Sale has already been paid.',
    code: 'PENDING_SALE_CONFLICT',
  }, { status: 409 });
  const adapter = createHttpPendingSaleAdapter(fetcher as typeof fetch);

  assert.deepEqual(await adapter.save({ ...request, id: 'pending-1' }), {
    kind: 'conflict',
    message: 'This Pending Sale has already been paid.',
  });
});

test('the HTTP adapter maps an already-deleted bill to a lifecycle conflict', async () => {
  const fetcher = async () => Response.json({ error: 'Pending sale was not found.' }, { status: 404 });
  const adapter = createHttpPendingSaleAdapter(fetcher as typeof fetch);

  assert.deepEqual(await adapter.delete('pending-1'), {
    kind: 'conflict',
    message: 'This Pending Sale is no longer available.',
  });
});

test('loading a Pending Sale fails explicitly when the database API is unavailable', async () => {
  const fetcher = async () => Response.json({ error: 'Unavailable' }, { status: 503 });

  await assert.rejects(
    loadPendingSale('pending-1', fetcher as typeof fetch),
    /Unable to load pending sale/,
  );
});

const pendingSale: SavedSale = {
  id: 'pending-member', billNo: 'INV-1', date: '2026-09-03T00:00:00.000Z',
  customerId: 'member-1', customerName: 'Anong', customerMobile: '0812345678',
  isMember: true, itemCount: 1, paymentMethod: 'Cash', purchaseMethod: 'pickup',
  netTotal: 50, status: 'pending', ownerId: 'o1', billDate: '2026-09-03',
  pharmacistId: 'p1', lines: request.lines, discount: null,
};
const member: Customer = {
  id: 'member-1', name: 'Anong', mobile: '0812345678', isMember: true,
  points: 120, membershipRank: 'Silver', topItemIds: ['product-1'],
  allergies: [{ id: 'ingredient-1', canonicalName: 'Paracetamol' }],
};

test('reopening a member bill loads its allergy and loyalty data without the member directory', async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.startsWith('/api/sales?')) return Response.json({ sales: [pendingSale] });
    if (url === '/api/members?memberId=member-1') return Response.json({ member });
    if (url.startsWith('/api/stock?')) return Response.json({ products: [], page: 1, pageSize: 1, total: 0, hasMore: false });
    throw new Error(`Unexpected request: ${url}`);
  };
  const loaded = await loadPendingSale(pendingSale.id, fetcher);
  assert.deepEqual(loaded?.sale.customer, member);
});

test('reopening fails instead of inventing an allergy-free member when their profile is unavailable', async () => {
  for (const response of [
    Response.json({ error: 'Unavailable' }, { status: 503 }),
    Response.json({ error: 'Missing' }, { status: 404 }),
    Response.json({ member: { ...member, id: 'another-member' } }),
    Response.json({ member: { ...member, allergies: undefined } }),
  ]) {
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      if (url.startsWith('/api/sales?')) return Response.json({ sales: [pendingSale] });
      if (url.startsWith('/api/members?')) return response;
      return Response.json({ products: [], page: 1, pageSize: 1, total: 0, hasMore: false });
    };
    await assert.rejects(loadPendingSale(pendingSale.id, fetcher), /Pending Sale customer/);
  }
});

test('walk-in bills reopen without a member request', async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.startsWith('/api/sales?')) {
      return Response.json({ sales: [{ ...pendingSale, customerId: null, isMember: false }] });
    }
    if (url.startsWith('/api/stock?')) return Response.json({ products: [], page: 1, pageSize: 1, total: 0, hasMore: false });
    throw new Error(`Unexpected request: ${url}`);
  };
  const loaded = await loadPendingSale(pendingSale.id, fetcher);
  assert.equal(loaded?.sale.customer, null);
  assert.deepEqual(loaded?.sale.lines, request.lines);
});
