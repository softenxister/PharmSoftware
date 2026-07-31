import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { searchStockCatalog } from '@/api/stockCatalogClient';
import type { TranslationKey, TranslationParams } from '@/i18n/i18n';
import {
  getItemSearchPriority,
  mergeCatalogItems,
  productsToCatalog,
} from './saleCatalog';
import { normalizeThaiKeyboardBarcodeInput } from './saleDraft';
import type { CatalogItem, Customer } from './saleTypes';
import { useClickOutside } from './useClickOutside';

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

export function useSaleCatalog(t: Translate) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customerLoadError, setCustomerLoadError] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [highlightedCustomerIndex, setHighlightedCustomerIndex] = useState(0);
  const customerFieldRef = useClickOutside<HTMLDivElement>(
    () => setCustomerDropdownOpen(false),
  );

  const [itemQuery, setItemQuery] = useState('');
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [highlightedItemIndex, setHighlightedItemIndex] = useState(0);
  const itemFieldRef = useClickOutside<HTMLDivElement>(
    () => setItemDropdownOpen(false),
  );
  const itemSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);

  const customerMatches = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((candidate) => (
      candidate.name.toLowerCase().includes(query)
      || candidate.mobile.replace(/-/g, '').includes(query.replace(/-/g, ''))
    ));
  }, [customerQuery, customers]);

  useEffect(() => setHighlightedCustomerIndex(0), [customerQuery]);
  useEffect(() => {
    setHighlightedCustomerIndex((current) => (
      customerMatches.length === 0 ? 0 : Math.min(current, customerMatches.length - 1)
    ));
  }, [customerMatches.length]);

  const itemSearchQuery = normalizeThaiKeyboardBarcodeInput(itemQuery).trim();
  const itemMatches = useMemo(() => {
    if (!itemSearchQuery) return [];
    return catalog
      .map((item) => ({ item, priority: getItemSearchPriority(item, itemSearchQuery) }))
      .filter((result): result is { item: CatalogItem; priority: number } => result.priority !== null)
      .sort((first, second) => first.priority - second.priority || first.item.name.localeCompare(second.item.name))
      .slice(0, 8)
      .map(({ item }) => item);
  }, [catalog, itemSearchQuery]);

  useEffect(() => setHighlightedItemIndex(0), [itemQuery]);
  useEffect(() => {
    setHighlightedItemIndex((current) => (
      itemMatches.length === 0 ? 0 : Math.min(current, itemMatches.length - 1)
    ));
  }, [itemMatches.length]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setItemSearchLoading(true);
      try {
        const products = await searchStockCatalog(itemSearchQuery);
        if (!cancelled) {
          setCatalog((current) => mergeCatalogItems(current, productsToCatalog(products)));
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setItemSearchLoading(false);
      }
    }, itemSearchQuery ? 150 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [itemSearchQuery]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setCustomerLoadError('');
      try {
        const response = await fetch('/api/members', { cache: 'no-store' });
        const data = await response.json() as { members?: Customer[]; error?: string };
        if (!response.ok) throw new Error(data.error || t('member.loadError'));
        if (!cancelled) setCustomers(Array.isArray(data.members) ? data.members : []);
      } catch (error) {
        if (!cancelled) {
          setCustomerLoadError(error instanceof Error ? error.message : t('member.loadError'));
        }
      } finally {
        if (!cancelled) setCustomersLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => itemSearchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, []);

  function selectCustomer(nextCustomer: Customer) {
    setCustomer(nextCustomer);
    setCustomerDropdownOpen(false);
  }

  function handleCustomerSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!customerDropdownOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setCustomerDropdownOpen(true);
    }
    if (event.key === 'ArrowDown' && customerMatches.length > 0) {
      event.preventDefault();
      setHighlightedCustomerIndex((current) => (current + 1) % customerMatches.length);
    } else if (event.key === 'ArrowUp' && customerMatches.length > 0) {
      event.preventDefault();
      setHighlightedCustomerIndex((current) => (current - 1 + customerMatches.length) % customerMatches.length);
    } else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      const highlighted = customerMatches[highlightedCustomerIndex] ?? customerMatches[0];
      if (highlighted) {
        event.preventDefault();
        selectCustomer(highlighted);
      }
    } else if (event.key === 'Escape') {
      setCustomerDropdownOpen(false);
    }
  }

  return {
    customers,
    customersLoaded,
    customerLoadError,
    customer,
    setCustomer,
    customerQuery,
    setCustomerQuery,
    customerDropdownOpen,
    setCustomerDropdownOpen,
    highlightedCustomerIndex,
    setHighlightedCustomerIndex,
    customerFieldRef,
    customerMatches,
    itemQuery,
    setItemQuery,
    itemDropdownOpen,
    setItemDropdownOpen,
    highlightedItemIndex,
    setHighlightedItemIndex,
    itemFieldRef,
    itemSearchInputRef,
    itemSearchLoading,
    catalog,
    setCatalog,
    itemSearchQuery,
    itemMatches,
    selectCustomer,
    handleCustomerSearchKeyDown,
  };
}
