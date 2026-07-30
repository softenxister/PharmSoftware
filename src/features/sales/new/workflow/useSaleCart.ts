import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { PosPreferences } from '@/config/preferences/posPreferences';
import { requiresPosConfirmation } from '@/config/preferences/posPreferences';
import {
  availableStockForPack,
  cartLineGroupKey,
  catalogItemForLine,
  createReminderFromDefaultDosage,
  groupSaleLinesForDisplay,
  mergeCartLinesByItemPack,
  replaceCartGroupQuantity,
  totalAvailableStockForPack,
  totalTabsForLine,
} from './saleDraft';
import type {
  Batch,
  CartLine,
  CatalogItem,
  EditorState,
  PendingConfirmation,
  ReminderDoses,
  ReminderState,
  SellPack,
} from './saleTypes';
import { useClickOutside } from './useClickOutside';

const REMINDER_TIME_COUNT = 4;

type Params = {
  catalog: CatalogItem[];
  itemSearchQuery: string;
  itemMatches: CatalogItem[];
  highlightedItemIndex: number;
  setHighlightedItemIndex: Dispatch<SetStateAction<number>>;
  setItemQuery: Dispatch<SetStateAction<string>>;
  itemDropdownOpen: boolean;
  setItemDropdownOpen: Dispatch<SetStateAction<boolean>>;
  itemSearchInputRef: RefObject<HTMLInputElement | null>;
  preferences: PosPreferences;
  navigateToSales: () => void;
};

function nearestExpiryBatchForPack(batches: Batch[], pack: SellPack): Batch | null {
  const available = batches.filter((batch) => availableStockForPack(batch, pack) > 0);
  return available.sort((first, second) => {
    if (!first.exp) return 1;
    if (!second.exp) return -1;
    return first.exp.localeCompare(second.exp);
  })[0] ?? null;
}

export function useSaleCart(params: Params) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const batchPickerRef = useClickOutside<HTMLDivElement>(() => {
    setEditor((current) => current?.batchCardOpen
      ? { ...current, batchCardOpen: false }
      : current);
  });
  const qtyInputRef = useRef<HTMLInputElement | null>(null);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [cartQtyDrafts, setCartQtyDrafts] = useState<Record<string, string>>({});
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderRows, setReminderRows] = useState<Record<string, ReminderState>>({});
  const [heldItemId, setHeldItemId] = useState<string | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const cartDisplayGroups = useMemo(() => groupSaleLinesForDisplay(
    cartLines,
    cartLineGroupKey,
    (line) => line.qty,
    (line) => line.batch.exp,
  ), [cartLines]);
  const totalQty = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.qty, 0),
    [cartLines],
  );
  const reminderEligibleLines = useMemo(() => cartDisplayGroups
    .map((group) => ({
      ...group.representative,
      lineId: group.key,
      qty: group.quantity,
    }))
    .filter((line) => totalTabsForLine(line, params.catalog) > 0), [
    cartDisplayGroups,
    params.catalog,
  ]);

  useEffect(() => {
    setCartLines((current) => {
      const merged = mergeCartLinesByItemPack(current, params.catalog);
      return merged.changed ? merged.lines : current;
    });
  }, [params.catalog]);

  function openEditorForItem(item: CatalogItem) {
    const sellPack = item.sellPacks.find(
      (pack) => pack.barcodes.includes(params.itemSearchQuery),
    ) ?? item.sellPacks[0];
    const batch = nearestExpiryBatchForPack(item.batches, sellPack);
    if (!batch) return;
    setEditor({ item, batch, sellPack, qty: '1', batchCardOpen: false });
    params.setItemQuery('');
    params.setItemDropdownOpen(false);
    window.setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  }

  function handleItemSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!params.itemDropdownOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      params.setItemDropdownOpen(true);
    }
    if (event.key === 'ArrowDown' && params.itemMatches.length > 0) {
      event.preventDefault();
      params.setHighlightedItemIndex((current) => (current + 1) % params.itemMatches.length);
    } else if (event.key === 'ArrowUp' && params.itemMatches.length > 0) {
      event.preventDefault();
      params.setHighlightedItemIndex(
        (current) => (current - 1 + params.itemMatches.length) % params.itemMatches.length,
      );
    } else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      const item = params.itemMatches[params.highlightedItemIndex] ?? params.itemMatches[0];
      if (item) {
        event.preventDefault();
        openEditorForItem(item);
      }
    } else if (event.key === 'Escape') {
      params.setItemDropdownOpen(false);
    }
  }

  function handleSelectBatch(batch: Batch) {
    if (!editor) return;
    const maxQuantity = totalAvailableStockForPack(editor.item.batches, editor.sellPack);
    const currentQuantity = parseInt(editor.qty, 10) || 1;
    setEditor({
      ...editor,
      batch,
      qty: String(Math.max(1, Math.min(currentQuantity, maxQuantity || 1))),
      batchCardOpen: false,
    });
    window.setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  }

  function handleSelectSellPack(pack: SellPack) {
    if (!editor) return;
    const nextBatch = availableStockForPack(editor.batch, pack) > 0
      ? editor.batch
      : nearestExpiryBatchForPack(editor.item.batches, pack);
    if (!nextBatch) return;
    const maxQuantity = totalAvailableStockForPack(editor.item.batches, pack);
    const currentQuantity = parseInt(editor.qty, 10) || 1;
    setEditor({
      ...editor,
      sellPack: pack,
      batch: nextBatch,
      qty: String(Math.max(1, Math.min(currentQuantity, maxQuantity))),
    });
    window.setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  }

  function commitEditorToCart() {
    if (!editor) return;
    const maxQuantity = totalAvailableStockForPack(editor.item.batches, editor.sellPack);
    if (maxQuantity <= 0) return;
    const quantity = Math.max(1, Math.min(parseInt(editor.qty, 10) || 1, maxQuantity));
    setCartLines((current) => {
      const key = `${editor.item.id}\u0000${editor.sellPack.displayLabel}\u0000${editor.sellPack.priceMultiplier}`;
      const currentQuantity = current
        .filter((line) => cartLineGroupKey(line) === key)
        .reduce((sum, line) => sum + line.qty, 0);
      return replaceCartGroupQuantity(
        current,
        editor.item,
        editor.sellPack,
        editor.batch,
        Math.min(maxQuantity, currentQuantity + quantity),
      );
    });
    setEditor(null);
    params.setItemQuery('');
    params.setItemDropdownOpen(false);
    window.setTimeout(() => params.itemSearchInputRef.current?.focus(), 0);
  }

  function removeCartLineImmediately(cartKey: string) {
    setCartLines((current) => current.filter((line) => cartLineGroupKey(line) !== cartKey));
    setCartQtyDrafts((current) => {
      const next = { ...current };
      delete next[cartKey];
      return next;
    });
    setReminderRows((current) => {
      const next = { ...current };
      delete next[cartKey];
      return next;
    });
  }

  function removeCartLine(cartKey: string) {
    const line = cartLines.find((candidate) => cartLineGroupKey(candidate) === cartKey);
    if (!line) return;
    if (requiresPosConfirmation(params.preferences, 'remove-item', cartLines.length > 0)) {
      setPendingConfirmation({ kind: 'remove-item', cartKey, itemName: line.itemName });
    } else {
      removeCartLineImmediately(cartKey);
    }
  }

  function leaveUnsavedSale() {
    if (requiresPosConfirmation(params.preferences, 'cancel-sale', cartLines.length > 0)) {
      setPendingConfirmation({ kind: 'cancel-sale' });
    } else {
      params.navigateToSales();
    }
  }

  function confirmPendingAction() {
    if (!pendingConfirmation) return;
    if (pendingConfirmation.kind === 'remove-item') {
      removeCartLineImmediately(pendingConfirmation.cartKey);
      setPendingConfirmation(null);
    } else {
      setPendingConfirmation(null);
      params.navigateToSales();
    }
  }

  function updateCartQty(cartKey: string, quantity: number) {
    setCartLines((current) => {
      const group = groupSaleLinesForDisplay(
        current.filter((line) => cartLineGroupKey(line) === cartKey),
        cartLineGroupKey,
        (line) => line.qty,
        (line) => line.batch.exp,
      )[0];
      if (!group) return current;
      const line = group.representative;
      const item = catalogItemForLine(line, params.catalog);
      const pack = item?.sellPacks.find(
        (candidate) => candidate.displayLabel === line.packLabel
          && candidate.priceMultiplier === line.packMultiplier,
      );
      return item && pack
        ? replaceCartGroupQuantity(current, item, pack, line.batch, quantity)
        : current;
    });
    setCartQtyDrafts((current) => {
      const next = { ...current };
      delete next[cartKey];
      return next;
    });
  }

  function updateReminderRow(lineId: string, update: (row: ReminderState) => ReminderState) {
    setReminderRows((current) => ({
      ...current,
      [lineId]: update(current[lineId] ?? createReminderFromDefaultDosage(undefined)),
    }));
  }

  function openReminderCard() {
    setReminderRows((current) => {
      const next = { ...current };
      reminderEligibleLines.forEach((line) => {
        const item = catalogItemForLine(line, params.catalog);
        next[line.lineId] ??= createReminderFromDefaultDosage(item?.defaultDosage);
      });
      return next;
    });
    setReminderOpen(true);
  }

  const toggleReminderLine = (lineId: string) => updateReminderRow(
    lineId,
    (row) => ({ ...row, enabled: !row.enabled }),
  );
  const setReminderTime = (lineId: string, activeTime: number) => updateReminderRow(
    lineId,
    (row) => ({ ...row, activeTime }),
  );

  function navigateReminderTime(lineId: string, currentTime: number, direction: -1 | 1) {
    const activeTime = (currentTime + direction + REMINDER_TIME_COUNT) % REMINDER_TIME_COUNT;
    updateReminderRow(lineId, (row) => ({ ...row, activeTime }));
    window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>(
        `[data-reminder-line="${lineId}"][data-reminder-time="${activeTime}"]`,
      )?.focus();
    }, 0);
  }

  function changeReminderDose(lineId: string, timeIndex: number, delta: -1 | 1) {
    updateReminderRow(lineId, (row) => {
      const doses = [...row.doses] as ReminderDoses;
      doses[timeIndex] = Math.max(0, Math.min(9, doses[timeIndex] + delta));
      return { ...row, activeTime: timeIndex, doses };
    });
  }

  function startHold(itemId: string) {
    holdTimerRef.current = window.setTimeout(() => setHeldItemId(itemId), 280);
  }
  function endHold() {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    setHeldItemId(null);
  }
  const handleTopItemTap = (item: CatalogItem) => openEditorForItem(item);

  return {
    editor,
    setEditor,
    batchPickerRef,
    qtyInputRef,
    cartLines,
    setCartLines,
    cartQtyDrafts,
    setCartQtyDrafts,
    cartDisplayGroups,
    totalQty,
    reminderOpen,
    setReminderOpen,
    reminderRows,
    setReminderRows,
    reminderEligibleLines,
    heldItemId,
    pendingConfirmation,
    setPendingConfirmation,
    openEditorForItem,
    handleItemSearchKeyDown,
    handleSelectBatch,
    handleSelectSellPack,
    commitEditorToCart,
    removeCartLine,
    leaveUnsavedSale,
    confirmPendingAction,
    updateCartQty,
    openReminderCard,
    toggleReminderLine,
    setReminderTime,
    navigateReminderTime,
    changeReminderDose,
    handleTopItemTap,
    startHold,
    endHold,
  };
}
