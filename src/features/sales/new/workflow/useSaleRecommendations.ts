import { useMemo } from 'react';
import { nearestAvailableExpiryBatch } from '@/lib/batchPresentation';
import type { TranslationKey, TranslationParams } from '@/i18n/i18n';
import { availableStockForPack, topWeeklyItemIds } from './saleDraft';
import type { CatalogItem, Customer, EditorState } from './saleTypes';

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

export function useSaleRecommendations(
  catalog: CatalogItem[],
  customer: Customer | null,
  editor: EditorState | null,
  t: Translate,
) {
  const weeklyTopItemIds = useMemo(() => topWeeklyItemIds(catalog), [catalog]);
  const topItemIds = customer?.isMember && customer.topItemIds?.length
    ? customer.topItemIds
    : weeklyTopItemIds;
  const topItems = useMemo(() => {
    const items = topItemIds
      .map((id) => catalog.find((item) => item.id === id))
      .filter((item): item is CatalogItem => Boolean(item))
      .slice(0, 10);
    if (items.length > 0) return items;
    return weeklyTopItemIds
      .map((id) => catalog.find((item) => item.id === id))
      .filter((item): item is CatalogItem => Boolean(item))
      .slice(0, 10);
  }, [catalog, topItemIds, weeklyTopItemIds]);

  const recommendedBatchId = useMemo(() => {
    if (!editor) return null;
    return nearestAvailableExpiryBatch(
      editor.item.batches,
      (batch) => batch.exp,
      (batch) => availableStockForPack(batch, editor.sellPack),
    )?.batchId ?? null;
  }, [editor]);

  return {
    topItems,
    topItemsLabel: customer?.isMember
      ? t('newSale.topFor', { name: customer.name.split(' ')[0] })
      : t('newSale.topWeekly'),
    recommendedBatchId,
  };
}
