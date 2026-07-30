import type { ProductPack, SalesProduct } from '@server/db/types';
import { buildSellPackOptions } from './saleDraft';
import type { CatalogItem, Customer } from './saleTypes';

function pluralChildUnit(unit: string, quantity: number): string {
  if (unit === 'tab') return quantity === 1 ? 'tab' : 'tabs';
  if (unit === 'caplet') return quantity === 1 ? 'caplet' : 'caplets';
  if (unit === 'piece') return quantity === 1 ? 'piece' : 'pieces';
  return unit;
}

function amountLabel(pack: ProductPack): string {
  return `${pack.childQuantity} ${pluralChildUnit(pack.childUnit, pack.childQuantity)}`;
}

export function productsToCatalog(products: SalesProduct[]): CatalogItem[] {
  return products.map((product) => ({
    id: product.id,
    barcode: product.barcode,
    barcodes: [
      product.barcode,
      ...(product.externalProductCode ? [product.externalProductCode] : []),
      ...(product.barcodes ?? []),
      ...product.parentPacks.flatMap((pack) => pack.barcodes ?? []),
    ],
    category: product.category,
    name: product.itemName,
    brand: product.brandName,
    manufacturer: product.manufacturerName,
    packLabel: amountLabel(product.pack),
    packUnit: product.pack.packUnit,
    sellPacks: buildSellPackOptions(
      product.pack,
      product.parentPacks,
      [product.barcode, ...(product.barcodes ?? [])],
    ),
    loc: product.location,
    image: product.imageUrl,
    weeklySold: product.weeklySold,
    discountPercent: product.discountPercent ?? 0,
    isDiscountLocked: product.isDiscountLocked ?? false,
    defaultDosage: product.defaultDosage ?? [0, 0, 0, 0],
    activeIngredients: (product.activeIngredients ?? []).map((ingredient) => ({
      id: ingredient.id,
      canonicalName: ingredient.canonicalName,
      ...(ingredient.thaiName ? { thaiName: ingredient.thaiName } : {}),
    })),
    batches: product.batches.map((batch) => ({
      batchId: `${product.id}-${batch.batchNo}-${batch.expiryDate}`,
      batchNo: batch.batchNo,
      exp: batch.expiryDate,
      sellPrice: batch.sellPriceThb,
      stock: batch.availableStock,
    })),
  }));
}

export function mergeCatalogItems(
  current: CatalogItem[],
  incoming: CatalogItem[],
): CatalogItem[] {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...incoming, ...current.filter((item) => !incomingIds.has(item.id))].slice(0, 200);
}

export function getItemSearchPriority(
  item: CatalogItem,
  rawQuery: string,
): number | null {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return null;
  if (/^\d{5,}$/.test(query)) {
    return item.barcodes.some((barcode) => barcode.includes(query)) ? 0 : null;
  }

  const itemName = item.name.toLowerCase();
  const brand = item.brand.toLowerCase();
  const manufacturer = item.manufacturer.toLowerCase();
  if (itemName.startsWith(query)) return 1;
  if (itemName.includes(query)) return 2;
  if (brand.startsWith(query)) return 3;
  if (brand.includes(query)) return 4;
  if (manufacturer.startsWith(query)) return 5;
  if (manufacturer.includes(query)) return 6;
  return null;
}

export function matchedAllergyIngredients(
  customer: Customer | null,
  item: CatalogItem,
) {
  if (!customer?.allergies?.length || item.activeIngredients.length === 0) return [];
  const allergyIds = new Set(customer.allergies.map((ingredient) => ingredient.id));
  return item.activeIngredients.filter((ingredient) => allergyIds.has(ingredient.id));
}
