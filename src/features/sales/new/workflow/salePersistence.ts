import {
  loadStockProductsByIds,
  refreshStockProductsByIds,
} from '@/api/stockCatalogClient';
import type { StorePaymentMethod } from '@/config/preferences/storePosSettings';
import { productsToCatalog } from './saleCatalog';
import {
  SAVED_SALES_KEY,
  type AppliedDiscount,
  type BillStatus,
  type CartLine,
  type CatalogItem,
  type Customer,
  type InvoiceCreated,
  type PurchaseMethod,
  type SavedSale,
  type SalesApiResponse,
} from './saleTypes';

export type SaleRequest = {
  status: BillStatus;
  id?: string;
  billNo?: string;
  owner: { id: string; name: string };
  pharmacist: { id: string; name: string };
  customer: Customer | null;
  paymentMethod: StorePaymentMethod;
  purchaseMethod: PurchaseMethod;
  subtotal: number;
  netPayable: number;
  customerPaid: number | null;
  changeDue: number;
  discount: AppliedDiscount | null;
  lines: CartLine[];
};

export async function postSale(request: SaleRequest): Promise<SalesApiResponse['sale']> {
  const response = await fetch('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await response.json() as SalesApiResponse;
  if (!response.ok) {
    throw new Error(data.error || (
      request.status === 'paid'
        ? 'Unable to update stock for this sale.'
        : 'Unable to save this sale.'
    ));
  }
  return data.sale;
}

export async function loadPendingSale(
  pendingBillId: string,
): Promise<{ sale: SavedSale; catalog: CatalogItem[] } | null> {
  const response = await fetch('/api/sales', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load pending sale.');
  const data = await response.json() as { sales?: SavedSale[] };
  const sale = data.sales?.find(
    (bill) => bill.id === pendingBillId && bill.status === 'pending',
  );
  if (!sale || !Array.isArray(sale.lines) || sale.lines.length === 0) return null;
  const products = await loadStockProductsByIds(sale.lines.map((line) => line.itemId));
  return { sale, catalog: productsToCatalog(products) };
}

export async function refreshSoldProductCatalog(
  productIds: string[],
): Promise<CatalogItem[]> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];
  const products = await refreshStockProductsByIds(ids);
  return productsToCatalog(products);
}

type RecentSaleInput = {
  id?: string;
  billNo?: string;
  createdAt?: string;
  customer: Customer | null;
  itemCount: number;
  paymentMethod: StorePaymentMethod;
  purchaseMethod: PurchaseMethod;
  netPayable: number;
  status: BillStatus;
  ownerId: string;
  billDate: string;
  pharmacistId: string;
  lines: CartLine[];
  discount: AppliedDiscount | null;
  customerPaid: number | null;
  changeDue: number;
};

export function persistRecentSale(
  storage: Storage,
  input: RecentSaleInput,
): InvoiceCreated {
  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
  const invoiceNo = input.billNo ?? `INV-${createdAt
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, '')}-${String(createdAt.getTime()).slice(-4)}`;
  const savedBill: SavedSale = {
    id: input.id ?? `saved-${createdAt.getTime()}`,
    billNo: invoiceNo,
    date: createdAt.toISOString(),
    customerName: input.customer?.name ?? 'Walk-in Customer',
    isMember: input.customer?.isMember ?? false,
    itemCount: input.itemCount,
    paymentMethod: input.paymentMethod,
    purchaseMethod: input.purchaseMethod,
    netTotal: input.netPayable,
    status: input.status,
    ownerId: input.ownerId,
    billDate: input.billDate,
    pharmacistId: input.pharmacistId,
    customerId: input.customer?.id ?? null,
    lines: input.lines,
    discount: input.discount,
  };

  let previousSales: SavedSale[] = [];
  try {
    previousSales = JSON.parse(storage.getItem(SAVED_SALES_KEY) ?? '[]') as SavedSale[];
  } catch {
    previousSales = [];
  }
  const otherSales = previousSales.filter((bill) => bill.id !== savedBill.id);
  storage.setItem(SAVED_SALES_KEY, JSON.stringify([savedBill, ...otherSales].slice(0, 30)));

  return {
    saleId: savedBill.id,
    invoiceNo,
    amountPaid: input.customerPaid ?? input.netPayable,
    netTotal: input.netPayable,
    changeDue: input.changeDue,
    paymentMode: input.paymentMethod,
    createdAt: createdAt.toISOString(),
  };
}
