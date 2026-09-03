import {
  loadStockProductsByIds,
  refreshStockProductsByIds,
} from '@/api/stockCatalogClient';
import type { PendingSaleAdapter } from './pendingSaleLifecycle';
import { productsToCatalog } from './saleCatalog';
import {
  type CatalogItem,
  type SaleWriteRequest,
  type SavedSale,
  type SalesApiResponse,
} from './saleTypes';

export class SaleWriteError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'SaleWriteError';
    this.code = code;
    this.status = status;
  }
}

export async function postSale(
  request: SaleWriteRequest,
  fetcher: typeof fetch = fetch,
): Promise<NonNullable<SalesApiResponse['sale']>> {
  const response = await fetcher('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await response.json() as SalesApiResponse;
  if (!response.ok || !data.sale) {
    throw new SaleWriteError(data.error || (
      request.status === 'paid'
        ? 'Unable to update stock for this sale.'
        : 'Unable to save this sale.'
    ), response.status, data.code);
  }
  return data.sale;
}

export async function deletePendingSale(
  saleId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher('/api/sales', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saleId }),
  });
  const data = await response.json() as { deletedSaleId?: string; error?: string };
  if (!response.ok || data.deletedSaleId !== saleId) {
    throw new SaleWriteError(data.error || 'Unable to delete pending sale.', response.status);
  }
}

export async function loadPendingSale(
  pendingBillId: string,
  fetcher: typeof fetch = fetch,
): Promise<{ sale: SavedSale; catalog: CatalogItem[] } | null> {
  const response = await fetcher(`/api/sales?saleId=${encodeURIComponent(pendingBillId)}`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Unable to load pending sale.');
  const data = await response.json() as { sales?: SavedSale[] };
  const sale = data.sales?.find(
    (bill) => bill.id === pendingBillId && bill.status === 'pending',
  );
  if (!sale || !Array.isArray(sale.lines) || sale.lines.length === 0) return null;
  const products = await loadStockProductsByIds(sale.lines.map((line) => line.itemId), fetcher);
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

export function createHttpPendingSaleAdapter(fetcher: typeof fetch = fetch): PendingSaleAdapter {
  return {
    load: (saleId) => loadPendingSale(saleId, fetcher),
    save: async (request) => {
      try {
        return { kind: 'saved', sale: await postSale(request, fetcher) };
      } catch (error) {
        if (error instanceof SaleWriteError && error.code === 'PENDING_SALE_CONFLICT') {
          return { kind: 'conflict', message: error.message };
        }
        throw error;
      }
    },
    delete: async (saleId) => {
      try {
        await deletePendingSale(saleId, fetcher);
        return { kind: 'deleted' };
      } catch (error) {
        if (error instanceof SaleWriteError && error.status === 404) {
          return { kind: 'conflict', message: 'This Pending Sale is no longer available.' };
        }
        throw error;
      }
    },
  };
}
