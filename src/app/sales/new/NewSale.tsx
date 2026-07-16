"use client";

import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Settings } from 'lucide-react';
import { usePreferences } from '@/app/PreferencesProvider';
import { MemberAvatar } from '@/app/member/MemberAvatarView';
import styles from './NewSale.module.css';
import type { ParentPack, ProductPack, SalesProduct } from '@/server/db/types';
import type { PharmUser } from '@/server/auth/pharmUser';
import { loadStockCatalog, updateStockCatalog } from '@/app/stock/stockCatalogClient';
import { requiresPosConfirmation } from '@/app/settings/posPreferences';
import {
  getPaymentMethodShortcut,
  resolveConfiguredPaymentMethod,
  shouldUsePaymentToggle,
  type StorePaymentMethod,
} from '@/app/settings/storePosSettings';
import { usePosPreferences } from '@/app/settings/usePosPreferences';
import { useStorePosSettings } from '@/app/settings/useStorePosSettings';
import { PosConfirmationDialog } from './PosConfirmationDialog';
import { buildProductDescription, shouldUseSellPackDropdown } from './salesPresentation';
import { resolveSaleShortcut, subscribeSaleShortcuts } from './salesShortcuts';
import morningReminderIcon from '@/styles/vector/morning.png';
import noonReminderIcon from '@/styles/vector/noon.png';
import eveningReminderIcon from '@/styles/vector/evening.png';
import nightReminderIcon from '@/styles/vector/night.png';

/* ════════════════════════════════════════════════════════════════════
   Types — swap for generated API types once the backend contracts land.
   ════════════════════════════════════════════════════════════════════ */

type PurchaseMethod = 'pickup' | 'delivery';
type DiscountType = 'percent' | 'thb';
type AppliedDiscount = { type: DiscountType; value: number };
type SaveMode = 'save' | 'save-print' | 'save-new';
type BillStatus = 'paid' | 'pending';
type ReminderDoses = [number, number, number, number];
type ReminderState = { enabled: boolean; activeTime: number; doses: ReminderDoses };

interface Owner {
  id: string;
  name: string;
}

interface Pharmacist {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
  mobile: string;
  avatarUrl?: string | null;
  isMember: boolean;
  points: number;
  membershipRank: string;
  topItemIds?: string[]; // this customer's personal top-10 purchased items
  allergies: Array<{
    id: string;
    canonicalName: string;
    thaiName?: string;
  }>;
}

interface Batch {
  batchId: string;
  batchNo: string;
  exp: string; // ISO date
  sellPrice: number;
  stock: number;
}

interface SellPack {
  key: string;
  unit: string;
  label: string;
  relationLabel: string;
  displayLabel: string;
  priceMultiplier: number;
}

interface CatalogItem {
  id: string;
  barcode: string;
  category: string;
  name: string;
  brand: string;
  manufacturer: string;
  packLabel: string;
  packUnit: string;
  sellPacks: SellPack[];
  loc: string;
  image: string;
  weeklySold: number;
  activeIngredients: Array<{
    id: string;
    canonicalName: string;
    thaiName?: string;
  }>;
  batches: Batch[];
}

interface CartLine {
  lineId: string;
  itemId: string;
  itemName: string;
  packLabel: string;
  packMultiplier: number;
  loc: string;
  batch: Batch;
  qty: number;
}

interface EditorState {
  item: CatalogItem;
  batch: Batch;
  sellPack: SellPack;
  qty: string;
  batchCardOpen: boolean;
}

type SelectOption = {
  value: string;
  label: string;
  shortcut?: string;
};

type InvoiceCreated = {
  invoiceNo: string;
  amountPaid: number;
  netTotal: number;
  changeDue: number;
  paymentMode: string;
  createdAt: string;
};

type PendingConfirmation =
  | { kind: 'remove-item'; lineId: string; itemName: string }
  | { kind: 'cancel-sale' };

type SalesApiResponse = {
  products?: SalesProduct[] | null;
  sale?: {
    id: string;
    billNo: string;
    date: string;
    status: BillStatus;
  };
  error?: string;
};

type SavedSale = {
  id: string;
  billNo: string;
  date: string;
  customerName: string;
  isMember: boolean;
  itemCount: number;
  paymentMethod: string;
  purchaseMethod: PurchaseMethod;
  netTotal: number;
  status: BillStatus;
  ownerId: string | null;
  billDate: string;
  pharmacistId: string | null;
  customerId: string | null;
  lines: CartLine[];
  discount: AppliedDiscount | null;
};

const REMINDER_TIMES = [
  { label: '8 AM', icon: morningReminderIcon },
  { label: '1 PM', icon: noonReminderIcon },
  { label: '7 PM', icon: eveningReminderIcon },
  { label: '10 PM', icon: nightReminderIcon },
] as const;

function createDefaultReminder(totalTabs = 1): ReminderState {
  return { enabled: true, activeTime: 0, doses: [Math.max(1, totalTabs), 0, 0, 0] };
}

/* ════════════════════════════════════════════════════════════════════
   Mock data — replace with real API calls (owners, staff, catalog…)
   ════════════════════════════════════════════════════════════════════ */

const OWNERS: Owner[] = [
  { id: 'o1', name: 'Sukhumvit Branch — K. Anong' },
  { id: 'o2', name: 'Thonglor Branch — K. Preecha' },
  { id: 'o3', name: 'Head Office Account' },
];

const SAVED_SALES_KEY = 'pharm_recent_sales';

const PHARMACISTS: Pharmacist[] = [
  { id: 'p1', name: 'Ph. Nattaya S.' },
  { id: 'p2', name: 'Ph. Somchai T.' },
  { id: 'p3', name: 'Ph. Kanokwan R.' },
];

function pluralChildUnit(unit: string, qty: number): string {
  if (unit === 'tab') return qty === 1 ? 'tab' : 'tabs';
  if (unit === 'caplet') return qty === 1 ? 'caplet' : 'caplets';
  if (unit === 'piece') return qty === 1 ? 'piece' : 'pieces';
  return unit;
}

function displayPackUnit(unit: string): string {
  if (unit === 'blisterpack') return 'blister packs';
  return unit;
}

function sellPackButtonLabel(unit: string): string {
  if (unit === 'blisterpack') return 'blister';
  return unit;
}

function amountLabel(pack: ProductPack): string {
  return `${pack.childQuantity} ${pluralChildUnit(pack.childUnit, pack.childQuantity)}`;
}

function productsToCatalog(products: SalesProduct[]): CatalogItem[] {
  return products.map((product) => ({
    id: product.id,
    barcode: product.barcode,
    category: product.category,
    name: product.itemName,
    brand: product.brandName,
    manufacturer: product.manufacturerName,
    packLabel: amountLabel(product.pack),
    packUnit: product.pack.packUnit,
    sellPacks: [
      {
        key: product.pack.packUnit,
        unit: product.pack.packUnit,
        label: sellPackButtonLabel(product.pack.packUnit),
        relationLabel: product.pack.label,
        displayLabel: `${product.pack.childQuantity} / ${displayPackUnit(product.pack.packUnit)}`,
        priceMultiplier: 1,
      },
      ...product.parentPacks.map((pack: ParentPack) => ({
        key: pack.packUnit,
        unit: pack.packUnit,
        label: sellPackButtonLabel(pack.packUnit),
        relationLabel: pack.label,
        displayLabel: `${pack.childPackQuantity} / ${displayPackUnit(pack.packUnit)}`,
        priceMultiplier: pack.priceMultiplier,
      })),
    ],
    loc: product.location,
    image: product.imageUrl,
    weeklySold: product.weeklySold,
    activeIngredients: (product.activeIngredients ?? []).map((ingredient) => ({
      id: ingredient.id,
      canonicalName: ingredient.canonicalName,
      ...(ingredient.thaiName ? { thaiName: ingredient.thaiName } : {}),
    })),
    batches: product.batches.map((batch) => ({
      batchId: `${product.id}-${batch.batchNo}`,
      batchNo: batch.batchNo,
      exp: batch.expiryDate,
      sellPrice: batch.sellPriceThb,
      stock: batch.availableStock,
    })),
  }));
}

/* ════════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════════ */

function formatBaht(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseExpiryDate(value: string): Date {
  const dayFirst = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dayFirst) {
    return new Date(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
  }

  return new Date(value);
}

function nearestExpiryBatch(batches: Batch[]): Batch | null {
  const inStock = batches.filter((b) => b.stock > 0);
  if (inStock.length === 0) return null;
  return [...inStock].sort((a, b) => parseExpiryDate(a.exp).getTime() - parseExpiryDate(b.exp).getTime())[0];
}

function nearestExpiryBatchForPack(batches: Batch[], pack: SellPack): Batch | null {
  const inStock = batches.filter((b) => availableStockForPack(b, pack) > 0);
  if (inStock.length === 0) return null;
  return [...inStock].sort((a, b) => parseExpiryDate(a.exp).getTime() - parseExpiryDate(b.exp).getTime())[0];
}

function availableStockForPack(batch: Batch, pack: SellPack): number {
  return Math.floor(batch.stock / pack.priceMultiplier);
}

function sellPriceForPack(batch: Batch, pack: SellPack): number {
  return batch.sellPrice * pack.priceMultiplier;
}

function catalogItemForLine(line: CartLine, catalog: CatalogItem[]): CatalogItem | undefined {
  return catalog.find((item) => item.id === line.itemId);
}

function totalTabsForLine(line: CartLine, catalog: CatalogItem[]): number {
  const catalogItem = catalogItemForLine(line, catalog);
  if (!catalogItem || !/(tab|caplet)/i.test(catalogItem.packLabel)) return 0;
  const childQty = parseInt(catalogItem.packLabel.match(/\d+/)?.[0] ?? '1', 10);
  return line.qty * line.packMultiplier * childQty;
}

function maxQtyForCartLine(line: CartLine, catalog: CatalogItem[]): number {
  const catalogItem = catalogItemForLine(line, catalog);
  const pack = catalogItem?.sellPacks.find((sellPack) => (
    sellPack.displayLabel === line.packLabel &&
    sellPack.priceMultiplier === line.packMultiplier
  ));
  if (!catalogItem || !pack) {
    return Math.max(1, Math.floor(line.batch.stock / line.packMultiplier));
  }
  return Math.max(1, catalogItem.batches.reduce((sum, batch) => sum + availableStockForPack(batch, pack), 0));
}

function mergeCartLinesByItemPack(lines: CartLine[], catalog: CatalogItem[]): { lines: CartLine[]; changed: boolean } {
  const mergedLines: CartLine[] = [];
  const lineIndexByKey = new Map<string, number>();
  let changed = false;

  lines.forEach((line) => {
    const key = `${line.itemId}|${line.packLabel}|${line.packMultiplier}`;
    const existingIndex = lineIndexByKey.get(key);
    if (existingIndex === undefined) {
      lineIndexByKey.set(key, mergedLines.length);
      mergedLines.push(line);
      return;
    }

    changed = true;
    const existingLine = mergedLines[existingIndex];
    if (!existingLine) return;
    mergedLines[existingIndex] = {
      ...existingLine,
      qty: Math.min(maxQtyForCartLine(existingLine, catalog), existingLine.qty + line.qty),
    };
  });

  return { lines: mergedLines, changed };
}

function calculateDiscountAmount(discount: AppliedDiscount | null, subtotal: number): number {
  if (!discount) return 0;
  const raw = discount.type === 'percent' ? (subtotal * discount.value) / 100 : discount.value;
  return Math.min(Math.max(raw, 0), subtotal);
}

/** Ranks barcode and item-name matches ahead of lower-priority manufacturer matches. */
function getItemSearchPriority(item: CatalogItem, rawQuery: string): number | null {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return null;
  if (/^\d{5,}$/.test(q)) {
    return item.barcode.includes(q) ? 0 : null;
  }

  const itemName = item.name.toLowerCase();
  const manufacturer = item.manufacturer.toLowerCase();
  if (itemName.startsWith(q)) return 1;
  if (itemName.includes(q)) return 2;
  if (manufacturer.startsWith(q)) return 3;
  if (manufacturer.includes(q)) return 4;
  return null;
}

function matchedAllergyIngredients(customer: Customer | null, item: CatalogItem) {
  if (!customer?.allergies?.length || item.activeIngredients.length === 0) return [];
  const allergyIds = new Set(customer.allergies.map((ingredient) => ingredient.id));
  return item.activeIngredients.filter((ingredient) => allergyIds.has(ingredient.id));
}

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onOutside]);
  return ref;
}

function CustomSelect({
  ariaLabel,
  value,
  options,
  onChange,
  className,
}: {
  ariaLabel: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const selected = options.find((option) => option.value === value) ?? options[0];
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selected?.value));
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(selectedIndex);
  }, [open, selectedIndex]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={`${styles.customSelect} ${className ?? ''}`} ref={ref}>
      <button
        type="button"
        className={styles.customSelectButton}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (options.length === 0) return;
            if (!open) {
              setOpen(true);
              return;
            }
            setHighlightedIndex((current) => (current + 1) % options.length);
            return;
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (options.length === 0) return;
            if (!open) {
              setOpen(true);
              return;
            }
            setHighlightedIndex((current) => (current - 1 + options.length) % options.length);
            return;
          }

          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (options.length === 0) return;
            if (!open) {
              setOpen(true);
              return;
            }
            const highlightedOption = options[highlightedIndex] ?? selected;
            if (highlightedOption) choose(highlightedOption.value);
            return;
          }

          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      >
        <span className={styles.customSelectValue}>
          {selected?.shortcut && <kbd className={styles.customSelectShortcut}>{selected.shortcut}</kbd>}
          <span>{selected?.label ?? ''}</span>
        </span>
        <IconChevronDown className={open ? styles.chevronOpen : ''} />
      </button>
      {open && (
        <div className={styles.customSelectMenu} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`${styles.customSelectOption} ${index === highlightedIndex ? styles.customSelectOptionActive : ''}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseMove={() => setHighlightedIndex(index)}
              onClick={() => choose(option.value)}
            >
              {option.shortcut && <kbd className={styles.customSelectShortcut}>{option.shortcut}</kbd>}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Small icon primitives
   ════════════════════════════════════════════════════════════════════ */

const IconBin = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" className={className} aria-hidden="true">
    <path d="M4 6.5h12M8 6.5V5a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 12 5v1.5M6 6.5l.6 9a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4l.6-9"
      fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconChevronDown = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" width="12" height="12" className={className} aria-hidden="true">
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconGear = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" width="17" height="17" className={className} aria-hidden="true">
    <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 2.7v1.9M10 15.4v1.9M17.3 10h-1.9M4.6 10H2.7M15.1 4.9l-1.35 1.35M6.25 13.75L4.9 15.1M15.1 15.1l-1.35-1.35M6.25 6.25L4.9 4.9"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconPill = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 22 22" width="16" height="16" className={className} aria-hidden="true">
    <g transform="rotate(-35 11 11)">
      <rect x="3.5" y="7" width="15" height="8" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11 7v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </g>
  </svg>
);

const IconSearch = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" className={className} aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M20 20l-4.2-4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const IconClose = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" width="13" height="13" className={className} aria-hidden="true">
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconTick = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" className={className} aria-hidden="true">
    <path d="M5 12.4l4.2 4.1L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconPrint = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" className={className} aria-hidden="true">
    <path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 12h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

/* ════════════════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════════════════ */

export default function NewSale({ user }: { user: PharmUser }): React.ReactElement {
  const navigate = useNavigate();
  const { t, formatDate, formatNumber } = usePreferences();
  const paymentMethodLabel = (method: StorePaymentMethod) => t(method === 'Cash'
    ? 'pos.cash'
    : method === 'Bank transfer' ? 'pos.bankTransfer' : 'pos.creditCard');
  const allergyWarningForItem = (item: CatalogItem) => {
    const matches = matchedAllergyIngredients(customer, item);
    return matches.length > 0
      ? t('newSale.allergyWarning', { ingredients: matches.map((ingredient) => ingredient.canonicalName).join(', ') })
      : '';
  };
  const formatExpiry = (value: string) => {
    const date = parseExpiryDate(value);
    return Number.isNaN(date.getTime()) ? value : formatDate(date, { month: 'short', year: '2-digit' });
  };
  const [searchParams] = useSearchParams();
  const pendingBillId = searchParams.get('billId');
  const { preferences } = usePosPreferences(user);
  const { settings: storeSettings } = useStorePosSettings();

  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editingBillNo, setEditingBillNo] = useState<string | null>(null);

  // Row 1 — toolbar
  const [ownerId, setOwnerId] = useState(OWNERS[0].id);
  const [paymentMethod, setPaymentMethod] = useState<StorePaymentMethod>('Cash');
  const [purchaseMethod, setPurchaseMethod] = useState<PurchaseMethod>('pickup');
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const saveMenuRef = useClickOutside<HTMLDivElement>(() => setSaveMenuOpen(false));

  // Row 2 — bill meta
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pharmacistId, setPharmacistId] = useState(PHARMACISTS[0].id);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customerLoadError, setCustomerLoadError] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [highlightedCustomerIndex, setHighlightedCustomerIndex] = useState(0);
  const customerFieldRef = useClickOutside<HTMLDivElement>(() => setCustomerDropdownOpen(false));

  // Item search + editor row
  const [itemQuery, setItemQuery] = useState('');
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [highlightedItemIndex, setHighlightedItemIndex] = useState(0);
  const itemFieldRef = useClickOutside<HTMLDivElement>(() => setItemDropdownOpen(false));
  const itemSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const batchPickerRef = useClickOutside<HTMLDivElement>(() => {
    setEditor((current) => {
      if (!current?.batchCardOpen) return current;
      return { ...current, batchCardOpen: false };
    });
  });
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  // Cart
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [cartQtyDrafts, setCartQtyDrafts] = useState<Record<string, string>>({});

  // Pill reminder modal
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderRows, setReminderRows] = useState<Record<string, ReminderState>>({});

  // Top items rail
  const [heldItemId, setHeldItemId] = useState<string | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  // Discount drawer
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [customerPayInput, setCustomerPayInput] = useState('');
  const [customerPayEdited, setCustomerPayEdited] = useState(false);
  const customerPayInputRef = useRef<HTMLInputElement | null>(null);
  const [invoiceCreated, setInvoiceCreated] = useState<InvoiceCreated | null>(null);
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleSubmitError, setSaleSubmitError] = useState('');
  const newSaleButtonRef = useRef<HTMLButtonElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [billingDevice, setBillingDevice] = useState('Front Counter Thermal Printer');
  const [cashDrawerDevice, setCashDrawerDevice] = useState('Front Counter Cash Drawer');
  const [paperSize, setPaperSize] = useState('80mm thermal');
  const [autoPrint, setAutoPrint] = useState(true);
  const [autoOpenCashDrawer, setAutoOpenCashDrawer] = useState(true);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const saleShortcutHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);

  /* ── Derived values ─────────────────────────────────────────────── */

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.mobile.replace(/-/g, '').includes(q.replace(/-/g, '')));
  }, [customerQuery, customers]);

  useEffect(() => {
    setHighlightedCustomerIndex(0);
  }, [customerQuery]);

  useEffect(() => {
    setHighlightedCustomerIndex((current) => {
      if (customerMatches.length === 0) return 0;
      return Math.min(current, customerMatches.length - 1);
    });
  }, [customerMatches.length]);

  const itemMatches = useMemo(() => {
    const q = itemQuery.trim();
    if (!q) return [];
    return catalog
      .map((item) => ({ item, priority: getItemSearchPriority(item, q) }))
      .filter((result): result is { item: CatalogItem; priority: number } => result.priority !== null)
      .sort((a, b) => a.priority - b.priority || a.item.name.localeCompare(b.item.name))
      .slice(0, 8)
      .map(({ item }) => item);
  }, [catalog, itemQuery]);

  useEffect(() => {
    setHighlightedItemIndex(0);
  }, [itemQuery]);

  useEffect(() => {
    setHighlightedItemIndex((current) => {
      if (itemMatches.length === 0) return 0;
      return Math.min(current, itemMatches.length - 1);
    });
  }, [itemMatches.length]);

  useEffect(() => {
    setPaymentMethod((current) => resolveConfiguredPaymentMethod(current, storeSettings.paymentMethods));
  }, [storeSettings.paymentMethods]);

  const totalQty = useMemo(() => cartLines.reduce((sum, l) => sum + l.qty, 0), [cartLines]);
  const uniqueItemCount = cartLines.length;
  const subtotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.qty * l.batch.sellPrice * l.packMultiplier, 0),
    [cartLines]
  );

  const discountAmount = useMemo(() => {
    return calculateDiscountAmount(appliedDiscount, subtotal);
  }, [appliedDiscount, subtotal]);

  const netPayable = Math.max(subtotal - discountAmount, 0);
  const draftDiscountAmount = useMemo(() => {
    const value = parseFloat(discountInput);
    if (Number.isNaN(value) || value <= 0) return discountAmount;
    return calculateDiscountAmount({ type: discountType, value }, subtotal);
  }, [discountAmount, discountInput, discountType, subtotal]);
  const draftNetPayable = Math.max(subtotal - draftDiscountAmount, 0);
  const customerPaidAmount = parseFloat(customerPayInput);
  const liveChangeDue = Number.isNaN(customerPaidAmount) ? 0 : Math.max(customerPaidAmount - draftNetPayable, 0);
  const canSaveSale = cartLines.length > 0 && Number.isFinite(netPayable) && netPayable > 0;
  const canOpenInvoiceBreakdown = canSaveSale;
  const reminderEligibleLines = useMemo(() => {
    return cartLines.filter((line) => totalTabsForLine(line, catalog) > 0);
  }, [cartLines, catalog]);

  const weeklyTopItemIds = useMemo(
    () => [...catalog]
      .sort((a, b) => b.weeklySold - a.weeklySold)
      .slice(0, 10)
      .map((item) => item.id),
    [catalog],
  );

  const topItemIds = useMemo(() => {
    if (customer && customer.isMember && customer.topItemIds?.length) return customer.topItemIds;
    return weeklyTopItemIds;
  }, [customer, weeklyTopItemIds]);

  const topItems = useMemo(() => {
    const mappedItems = topItemIds
      .map((id) => catalog.find((it) => it.id === id))
      .filter((it): it is CatalogItem => !!it)
      .slice(0, 10);

    return mappedItems.length > 0
      ? mappedItems
      : weeklyTopItemIds
        .map((id) => catalog.find((it) => it.id === id))
        .filter((it): it is CatalogItem => !!it)
        .slice(0, 10);
  }, [catalog, topItemIds, weeklyTopItemIds]);

  const topItemsLabel = customer && customer.isMember
    ? t('newSale.topFor', { name: customer.name.split(' ')[0] })
    : t('newSale.topWeekly');

  const recommendedBatchId = useMemo(
    () => (editor ? nearestExpiryBatch(editor.item.batches)?.batchId ?? null : null),
    [editor]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const products = await loadStockCatalog();
        if (!cancelled) setCatalog(productsToCatalog(products));
      } catch (error) {
        console.error(error);
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCustomers() {
      setCustomerLoadError('');
      try {
        const response = await fetch('/api/members', { cache: 'no-store' });
        const data = await response.json() as { members?: Customer[]; error?: string };
        if (!response.ok) throw new Error(data.error || t('member.loadError'));
        if (!cancelled) setCustomers(Array.isArray(data.members) ? data.members : []);
      } catch (error) {
        if (!cancelled) setCustomerLoadError(error instanceof Error ? error.message : t('member.loadError'));
      } finally {
        if (!cancelled) setCustomersLoaded(true);
      }
    }
    void loadCustomers();
    return () => { cancelled = true; };
  }, [t]);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => itemSearchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, []);

  useEffect(() => {
    if (!discountOpen) return;
    window.setTimeout(() => {
      customerPayInputRef.current?.focus();
      customerPayInputRef.current?.select();
    }, 0);
  }, [discountOpen]);

  useEffect(() => {
    if (!discountOpen || customerPayEdited) return;
    setCustomerPayInput(draftNetPayable.toFixed(2));
  }, [customerPayEdited, discountOpen, draftNetPayable]);

  useEffect(() => {
    if (!invoiceCreated) return;
    window.setTimeout(() => {
      newSaleButtonRef.current?.focus();
    }, 0);
  }, [invoiceCreated]);

  useEffect(() => {
    setCartLines((prev) => {
      const merged = mergeCartLinesByItemPack(prev, catalog);
      return merged.changed ? merged.lines : prev;
    });
  }, [cartLines, catalog]);

  useEffect(() => {
    let cancelled = false;
    if (!pendingBillId || !customersLoaded) return;

    async function loadPendingBill() {
      try {
        const response = await fetch('/api/sales', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load pending sale.');
        const data = await response.json() as { sales?: SavedSale[] };
        const savedBill = data.sales?.find((bill) => bill.id === pendingBillId && bill.status === 'pending');
        if (cancelled || !savedBill || !Array.isArray(savedBill.lines) || savedBill.lines.length === 0) return;

        setEditingBillId(savedBill.id);
        setEditingBillNo(savedBill.billNo);
        setOwnerId(savedBill.ownerId ?? OWNERS[0].id);
        setPaymentMethod(resolveConfiguredPaymentMethod(savedBill.paymentMethod ?? 'Cash', storeSettings.paymentMethods));
        setPurchaseMethod(savedBill.purchaseMethod ?? 'pickup');
        setBillDate(savedBill.billDate ?? savedBill.date.slice(0, 10));
        setPharmacistId(savedBill.pharmacistId ?? PHARMACISTS[0].id);
        setCustomer(customers.find((c) => c.id === savedBill.customerId) ?? null);
        setCustomerQuery('');
        setCartLines(savedBill.lines);
        setCartQtyDrafts({});
        setAppliedDiscount(savedBill.discount ?? null);
        if (savedBill.discount) {
          setDiscountType(savedBill.discount.type);
          setDiscountInput(String(savedBill.discount.value));
        }
      } catch (error) {
        if (!cancelled) {
          setSaleSubmitError(error instanceof Error ? error.message : 'Unable to load pending sale.');
        }
      }
    }

    void loadPendingBill();
    return () => {
      cancelled = true;
    };
  }, [customers, customersLoaded, pendingBillId, storeSettings.paymentMethods]);

  /* ── Handlers ───────────────────────────────────────────────────── */

  function openEditorForItem(item: CatalogItem) {
    const batch = nearestExpiryBatch(item.batches);
    if (!batch) return; // out of stock — nothing to sell
    setEditor({ item, batch, sellPack: item.sellPacks[0], qty: '1', batchCardOpen: false });
    setItemQuery('');
    setItemDropdownOpen(false);
    window.setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  }

  function handleItemSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!itemDropdownOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setItemDropdownOpen(true);
    }

    if (event.key === 'ArrowDown' && itemMatches.length > 0) {
      event.preventDefault();
      setHighlightedItemIndex((current) => (current + 1) % itemMatches.length);
      return;
    }

    if (event.key === 'ArrowUp' && itemMatches.length > 0) {
      event.preventDefault();
      setHighlightedItemIndex((current) => (current - 1 + itemMatches.length) % itemMatches.length);
      return;
    }

    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      const highlightedItem = itemMatches[highlightedItemIndex] ?? itemMatches[0];
      if (highlightedItem) {
        event.preventDefault();
        openEditorForItem(highlightedItem);
      }
      return;
    }

    if (event.key === 'Escape') {
      setItemDropdownOpen(false);
    }
  }

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
      return;
    }

    if (event.key === 'ArrowUp' && customerMatches.length > 0) {
      event.preventDefault();
      setHighlightedCustomerIndex((current) => (current - 1 + customerMatches.length) % customerMatches.length);
      return;
    }

    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      const highlightedCustomer = customerMatches[highlightedCustomerIndex] ?? customerMatches[0];
      if (highlightedCustomer) {
        event.preventDefault();
        selectCustomer(highlightedCustomer);
      }
      return;
    }

    if (event.key === 'Escape') {
      setCustomerDropdownOpen(false);
    }
  }

  function handleSelectBatch(batch: Batch) {
    if (!editor) return;
    const maxQty = availableStockForPack(batch, editor.sellPack);
    const currentQty = parseInt(editor.qty, 10) || 1;
    setEditor({ ...editor, batch, qty: String(Math.max(1, Math.min(currentQty, maxQty || 1))), batchCardOpen: false });
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
    const maxQty = availableStockForPack(nextBatch, pack);
    const currentQty = parseInt(editor.qty, 10) || 1;
    setEditor({ ...editor, sellPack: pack, batch: nextBatch, qty: String(Math.max(1, Math.min(currentQty, maxQty))) });
    window.setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  }

  function commitEditorToCart() {
    if (!editor) return;
    const maxQty = availableStockForPack(editor.batch, editor.sellPack);
    if (maxQty <= 0) return;
    const qty = Math.max(1, Math.min(parseInt(editor.qty, 10) || 1, maxQty));
    setCartLines((prev) => {
      const existingLine = prev.find((line) => (
        line.itemId === editor.item.id &&
        line.packLabel === editor.sellPack.displayLabel &&
        line.packMultiplier === editor.sellPack.priceMultiplier
      ));

      if (existingLine) {
        const mergedQty = Math.min(maxQtyForCartLine(existingLine, catalog), existingLine.qty + qty);
        return prev.map((line) => {
          if (line.lineId !== existingLine.lineId) return line;
          return { ...line, qty: mergedQty };
        });
      }

      return [
        ...prev,
        {
          lineId: `${editor.item.id}-${editor.sellPack.key}-${Date.now()}`,
          itemId: editor.item.id,
          itemName: editor.item.name,
          packLabel: editor.sellPack.displayLabel,
          packMultiplier: editor.sellPack.priceMultiplier,
          loc: editor.item.loc,
          batch: editor.batch,
          qty,
        },
      ];
    });
    setEditor(null);
    setItemQuery('');
    setItemDropdownOpen(false);
    window.setTimeout(() => {
      itemSearchInputRef.current?.focus();
    }, 0);
  }

  function removeCartLineImmediately(lineId: string) {
    setCartLines((prev) => prev.filter((l) => l.lineId !== lineId));
    setCartQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
    setReminderRows((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }

  function removeCartLine(lineId: string) {
    const line = cartLines.find((cartLine) => cartLine.lineId === lineId);
    if (!line) return;
    if (requiresPosConfirmation(preferences, 'remove-item', cartLines.length > 0)) {
      setPendingConfirmation({ kind: 'remove-item', lineId, itemName: line.itemName });
      return;
    }
    removeCartLineImmediately(lineId);
  }

  function leaveUnsavedSale() {
    if (requiresPosConfirmation(preferences, 'cancel-sale', cartLines.length > 0)) {
      setPendingConfirmation({ kind: 'cancel-sale' });
      return;
    }
    navigate('/sales');
  }

  function confirmPendingAction() {
    if (!pendingConfirmation) return;
    if (pendingConfirmation.kind === 'remove-item') {
      removeCartLineImmediately(pendingConfirmation.lineId);
      setPendingConfirmation(null);
      return;
    }
    setPendingConfirmation(null);
    navigate('/sales');
  }

  function updateCartQty(lineId: string, qty: number) {
    setCartLines((prev) => prev.map((l) => {
      if (l.lineId !== lineId) return l;
      const maxQty = maxQtyForCartLine(l, catalog);
      return { ...l, qty: Math.min(maxQty, Math.max(1, qty)) };
    }));
    setCartQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }

  function updateReminderRow(lineId: string, updater: (row: ReminderState) => ReminderState) {
    setReminderRows((prev) => {
      const current = prev[lineId] ?? createDefaultReminder();
      return { ...prev, [lineId]: updater(current) };
    });
  }

  function openReminderCard() {
    setReminderRows((prev) => {
      const next = { ...prev };
      reminderEligibleLines.forEach((line) => {
        const totalTabs = totalTabsForLine(line, catalog);
        if (!next[line.lineId]) {
          next[line.lineId] = createDefaultReminder(totalTabs);
          return;
        }
        next[line.lineId] = {
          ...next[line.lineId],
          doses: [Math.max(1, totalTabs), next[line.lineId].doses[1], next[line.lineId].doses[2], next[line.lineId].doses[3]],
        };
      });
      return next;
    });
    setReminderOpen(true);
  }

  function toggleReminderLine(lineId: string) {
    updateReminderRow(lineId, (row) => ({ ...row, enabled: !row.enabled }));
  }

  function setReminderTime(lineId: string, timeIndex: number) {
    updateReminderRow(lineId, (row) => ({ ...row, activeTime: timeIndex }));
  }

  function focusReminderCell(lineId: string, timeIndex: number) {
    window.setTimeout(() => {
      document
        .querySelector<HTMLButtonElement>(`[data-reminder-line="${lineId}"][data-reminder-time="${timeIndex}"]`)
        ?.focus();
    }, 0);
  }

  function navigateReminderTime(lineId: string, currentTimeIndex: number, direction: -1 | 1) {
    const nextTimeIndex = (currentTimeIndex + direction + REMINDER_TIMES.length) % REMINDER_TIMES.length;
    updateReminderRow(lineId, (row) => ({
      ...row,
      activeTime: nextTimeIndex,
    }));
    focusReminderCell(lineId, nextTimeIndex);
  }

  function changeReminderDose(lineId: string, timeIndex: number, delta: -1 | 1) {
    updateReminderRow(lineId, (row) => {
      const doses = [...row.doses] as ReminderDoses;
      doses[timeIndex] = Math.max(0, Math.min(9, doses[timeIndex] + delta));
      return { ...row, activeTime: timeIndex, doses };
    });
  }

  function handleTopItemTap(item: CatalogItem) {
    openEditorForItem(item);
  }

  function startHold(itemId: string) {
    holdTimerRef.current = window.setTimeout(() => setHeldItemId(itemId), 280);
  }

  function endHold() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHeldItemId(null);
  }

  function openDiscountDrawer() {
    if (!canOpenInvoiceBreakdown) return;
    setSaleSubmitError('');
    if (appliedDiscount) {
      setDiscountType(appliedDiscount.type);
      setDiscountInput(String(appliedDiscount.value));
    }
    setCustomerPayInput(netPayable.toFixed(2));
    setCustomerPayEdited(false);
    setDiscountOpen(true);
  }

  function openCashDrawer(reason: string) {
    if (!autoOpenCashDrawer) return;
    if (cashDrawerDevice === 'No Cash Drawer') return;
    console.log('Opening cash drawer', {
      cashDrawerDevice,
      billingDevice,
      reason,
    });
  }

  function handleCustomerPayEnter() {
    void submitInvoicePayment();
  }

  function addCustomerCash(amount: number) {
    const currentPaid = parseFloat(customerPayInput);
    const basePaid = customerPayEdited && !Number.isNaN(currentPaid) ? currentPaid : 0;
    const nextPaid = basePaid + amount;
    setCustomerPayEdited(true);
    setCustomerPayInput(String(nextPaid));
    window.setTimeout(() => {
      customerPayInputRef.current?.focus();
    }, 0);
  }

  function readDraftDiscount(): AppliedDiscount | null {
    const value = parseFloat(discountInput);
    if (Number.isNaN(value) || value <= 0) {
      return null;
    }
    return { type: discountType, value };
  }

  function resetForNewWalkIn() {
    setCartLines([]);
    setCartQtyDrafts({});
    setReminderRows({});
    setReminderOpen(false);
    setEditor(null);
    setAppliedDiscount(null);
    setDiscountInput('');
    setCustomerPayInput('');
    setCustomerPayEdited(false);
    setCustomer(null);
    setCustomerQuery('');
    setItemQuery('');
    setItemDropdownOpen(false);
    setDiscountOpen(false);
    setInvoiceCreated(null);
    setSaleSubmitting(false);
    setSaleSubmitError('');
    setEditingBillId(null);
    setEditingBillNo(null);
    setBillDate(new Date().toISOString().slice(0, 10));
    window.setTimeout(() => {
      itemSearchInputRef.current?.focus();
    }, 0);
  }

  function persistSale(mode: SaveMode, overrides: {
    id?: string;
    billNo?: string;
    createdAt?: string;
    discount?: AppliedDiscount | null;
    netPayable?: number;
    customerPaid?: number | null;
    changeDue?: number;
    status?: BillStatus;
  } = {}): InvoiceCreated {
    const billDateTime = overrides.createdAt ? new Date(overrides.createdAt) : new Date();
    const effectiveNetPayable = overrides.netPayable ?? netPayable;
    const effectiveCustomerPaid = overrides.customerPaid !== undefined
      ? overrides.customerPaid
      : parseFloat(customerPayInput) || null;
    const effectiveChangeDue = overrides.changeDue ?? liveChangeDue;
    const saleStatus = overrides.status ?? 'paid';
    const invoiceNo = overrides.billNo ?? editingBillNo ?? `INV-${billDateTime
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, '')}-${String(billDateTime.getTime()).slice(-4)}`;
    const savedBill = {
      id: overrides.id ?? editingBillId ?? `saved-${billDateTime.getTime()}`,
      billNo: invoiceNo,
      date: billDateTime.toISOString(),
      customerName: customer?.name ?? 'Walk-in Customer',
      isMember: customer?.isMember ?? false,
      itemCount: cartLines.length,
      paymentMethod,
      purchaseMethod,
      netTotal: effectiveNetPayable,
      status: saleStatus,
      ownerId,
      billDate,
      pharmacistId,
      customerId: customer?.id ?? null,
      lines: cartLines,
      discount: overrides.discount ?? appliedDiscount,
    };

    const savedSales = window.localStorage.getItem(SAVED_SALES_KEY);
    let previousSales = [];
    try {
      previousSales = savedSales ? JSON.parse(savedSales) : [];
    } catch {
      previousSales = [];
    }
    const otherSales = previousSales.filter((bill: SavedSale) => bill.id !== savedBill.id);
    window.localStorage.setItem(SAVED_SALES_KEY, JSON.stringify([savedBill, ...otherSales].slice(0, 30)));

    return {
      invoiceNo,
      amountPaid: effectiveCustomerPaid ?? effectiveNetPayable,
      netTotal: effectiveNetPayable,
      changeDue: effectiveChangeDue,
      paymentMode: paymentMethod,
      createdAt: billDateTime.toISOString(),
    };
  }

  async function submitInvoicePayment() {
    if (!canSaveSale || saleSubmitting) return;
    const nextDiscount = readDraftDiscount();
    const nextDiscountAmount = calculateDiscountAmount(nextDiscount, subtotal);
    const nextNetPayable = Math.max(subtotal - nextDiscountAmount, 0);
    const paid = parseFloat(customerPayInput);
    const nextChangeDue = Number.isNaN(paid) ? 0 : Math.max(paid - nextNetPayable, 0);

    setSaleSubmitting(true);
    setSaleSubmitError('');
    let savedSale: SalesApiResponse['sale'];

    try {
      const saleResponse = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          id: editingBillId ?? undefined,
          billNo: editingBillNo ?? undefined,
          owner: {
            id: ownerId,
            name: OWNERS.find((owner) => owner.id === ownerId)?.name ?? ownerId,
          },
          pharmacist: {
            id: pharmacistId,
            name: PHARMACISTS.find((pharmacist) => pharmacist.id === pharmacistId)?.name ?? pharmacistId,
          },
          customer,
          paymentMethod,
          purchaseMethod,
          subtotal,
          netPayable: nextNetPayable,
          customerPaid: Number.isNaN(paid) ? null : paid,
          changeDue: nextChangeDue,
          discount: nextDiscount,
          lines: cartLines,
        }),
      });
      const saleData = await saleResponse.json() as SalesApiResponse;

      if (!saleResponse.ok) {
        throw new Error(saleData.error || 'Unable to update stock for this sale.');
      }

      if (Array.isArray(saleData.products)) {
        updateStockCatalog(saleData.products);
        setCatalog(productsToCatalog(saleData.products));
      }
      savedSale = saleData.sale;
    } catch (error) {
      setSaleSubmitError(error instanceof Error ? error.message : 'Unable to update stock for this sale.');
      setSaleSubmitting(false);
      return;
    }

    if (!Number.isNaN(paid) && paid >= nextNetPayable) {
      openCashDrawer('customer payment submitted');
    }

    const createdInvoice = persistSale('save-new', {
      id: savedSale?.id,
      billNo: savedSale?.billNo,
      createdAt: savedSale?.date,
      discount: nextDiscount,
      netPayable: nextNetPayable,
      customerPaid: Number.isNaN(paid) ? null : paid,
      changeDue: nextChangeDue,
      status: 'paid',
    });
    setAppliedDiscount(nextDiscount);
    setDiscountOpen(false);
    setInvoiceCreated(createdInvoice);
    setSaleSubmitting(false);
  }

  function clearDiscount() {
    setAppliedDiscount(null);
    setDiscountInput('');
    setDiscountOpen(false);
  }

  async function handleSave(mode: SaveMode) {
    if (!canSaveSale || saleSubmitting) return;
    setSaleSubmitting(true);
    setSaleSubmitError('');

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'pending',
          id: editingBillId ?? undefined,
          billNo: editingBillNo ?? undefined,
          owner: {
            id: ownerId,
            name: OWNERS.find((owner) => owner.id === ownerId)?.name ?? ownerId,
          },
          pharmacist: {
            id: pharmacistId,
            name: PHARMACISTS.find((pharmacist) => pharmacist.id === pharmacistId)?.name ?? pharmacistId,
          },
          customer,
          paymentMethod,
          purchaseMethod,
          subtotal,
          netPayable,
          customerPaid: null,
          changeDue: 0,
          discount: appliedDiscount,
          lines: cartLines,
        }),
      });
      const data = await response.json() as SalesApiResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to save this sale.');

      persistSale(mode, {
        id: data.sale?.id,
        billNo: data.sale?.billNo,
        createdAt: data.sale?.date,
        status: 'pending',
        customerPaid: null,
        changeDue: 0,
      });
      setSaveMenuOpen(false);
      if (mode === 'save-new') {
        resetForNewWalkIn();
        return;
      }
      navigate('/sales');
    } catch (error) {
      setSaleSubmitError(error instanceof Error ? error.message : 'Unable to save this sale.');
      setSaleSubmitting(false);
    }
  }

  function handleSaleShortcut(event: KeyboardEvent) {
    if (event.defaultPrevented || event.repeat) return;
    const action = resolveSaleShortcut(event, storeSettings.paymentMethods);
    if (!action) return;
    event.preventDefault();

    if (action.type === 'select-payment') {
      setPaymentMethod(action.method);
      return;
    }
    if (invoiceCreated || reminderOpen || settingsOpen || pendingConfirmation) return;
    if (action.type === 'save-pending') {
      if (!discountOpen) void handleSave('save');
      return;
    }
    if (!discountOpen) openDiscountDrawer();
  }

  useEffect(() => {
    saleShortcutHandlerRef.current = handleSaleShortcut;
  });

  useEffect(() => subscribeSaleShortcuts(
    window,
    (event) => saleShortcutHandlerRef.current(event),
  ), []);

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <div className={styles.page}>
      {/* Row 1 — toolbar */}
      <div className={styles.toolbarRow}>
        <div className={styles.breadcrumb}>
          <button type="button" className={styles.breadcrumbLink} onClick={leaveUnsavedSale}>{t('nav.sales')}</button>
          <span className={styles.breadcrumbSep}>&gt;</span>
          <span className={styles.breadcrumbCurrent}>{t('nav.newSale')}</span>
        </div>

        <div className={styles.toolbarControls}>
          <CustomSelect
            ariaLabel={t('common.owner')}
            value={ownerId}
            options={OWNERS.map((owner) => ({ value: owner.id, label: owner.name }))}
            onChange={setOwnerId}
          />

          {shouldUsePaymentToggle(storeSettings.paymentMethods) ? (
            <div className={styles.paymentMethodToggle} role="group" aria-label={t('sales.payment')}>
              {storeSettings.paymentMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`${styles.paymentMethodToggleOption} ${paymentMethod === method ? styles.paymentMethodToggleOptionActive : ''}`}
                  aria-pressed={paymentMethod === method}
                  onClick={() => setPaymentMethod(method)}
                >
                  {preferences.showKeyboardHints && <kbd>{getPaymentMethodShortcut(method)}</kbd>}
                  <span>{paymentMethodLabel(method)}</span>
                </button>
              ))}
            </div>
          ) : (
            <CustomSelect
              ariaLabel={t('sales.payment')}
              value={paymentMethod}
              options={storeSettings.paymentMethods.map((method) => ({
                value: method,
                label: paymentMethodLabel(method),
                shortcut: preferences.showKeyboardHints ? getPaymentMethodShortcut(method) : undefined,
              }))}
              onChange={(method) => setPaymentMethod(method as StorePaymentMethod)}
            />
          )}

          <button
            type="button"
            className={styles.reminderButton}
            onClick={openReminderCard}
            aria-haspopup="dialog"
          >
            <IconPill />
            <span>{t('newSale.reminder')}</span>
          </button>

          <button
            type="button"
            className={`${styles.fulfilmentToggle} ${purchaseMethod === 'delivery' ? styles.fulfilmentToggleDelivery : ''}`}
            onClick={() => setPurchaseMethod((current) => (current === 'pickup' ? 'delivery' : 'pickup'))}
            aria-label={t('newSale.toggleFulfilment')}
            aria-pressed={purchaseMethod === 'delivery'}
          >
            <span className={styles.fulfilmentLabel}>{t(purchaseMethod === 'pickup' ? 'sales.pickup' : 'sales.delivery')}</span>
            <span className={styles.fulfilmentSwitch} aria-hidden="true">
              <span className={styles.fulfilmentSwitchThumb} />
            </span>
          </button>

          <div className={styles.saveSplit} ref={saveMenuRef}>
            <button type="button" className={styles.saveMain} onClick={() => handleSave('save')} disabled={!canSaveSale}>
              <span>{t('newSale.save')}</span>
              {preferences.showKeyboardHints && <kbd className={styles.actionShortcut}>Ctrl + S</kbd>}
            </button>
            <button
              type="button"
              className={styles.saveChevron}
              onClick={() => setSaveMenuOpen((v) => !v)}
              disabled={!canSaveSale}
              aria-haspopup="menu"
              aria-expanded={saveMenuOpen}
              aria-label={t('newSale.moreSave')}
            >
              <IconChevronDown />
            </button>
            {saveMenuOpen && (
              <div className={styles.saveMenu} role="menu">
                <button type="button" role="menuitem" className={styles.saveMenuItem} onClick={() => handleSave('save')} disabled={!canSaveSale}>{t('newSale.savePending')}</button>
                <button type="button" role="menuitem" className={styles.saveMenuItem} onClick={() => handleSave('save-new')} disabled={!canSaveSale}>{t('newSale.savePendingNew')}</button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.gearButton}
            title={t('newSale.settings')}
            aria-label={t('newSale.settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Row 2 — bill meta */}
      <div className={styles.metaRow}>
        <label className={`${styles.metaField} ${styles.dateField}`}>
          <span className={styles.metaLabel}>{t('newSale.billDate')}</span>
          <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={styles.dateInput} />
        </label>

        <div className={`${styles.metaField} ${styles.customerField}`} ref={customerFieldRef}>
          <span className={styles.metaLabel}>{t('sales.customer')}</span>
          {customer ? (
            <div className={styles.customerChip}>
              <MemberAvatar name={customer.name} avatarUrl={customer.avatarUrl} className={styles.avatar} />
              <div className={styles.customerChipMeta}>
                <span className={styles.customerChipName}>{customer.name}</span>
                <span className={styles.customerChipMobile}>
                  {customer.mobile} · {customer.membershipRank} · {formatNumber(customer.points)} {t('newSale.pointsShort')}
                </span>
              </div>
              <button
                type="button"
                className={styles.clearChip}
                onClick={() => { setCustomer(null); setCustomerQuery(''); }}
                aria-label={t('newSale.clearCustomer')}
              >
                <IconClose />
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={customerQuery}
                onChange={(e) => { setCustomerQuery(e.target.value); setCustomerDropdownOpen(true); }}
                onFocus={() => {
                  setCustomerDropdownOpen(true);
                  setHighlightedCustomerIndex(0);
                }}
                onKeyDown={handleCustomerSearchKeyDown}
                placeholder={t('newSale.searchCustomer')}
                className={styles.textInput}
              />
              {customerDropdownOpen && (
                <div className={styles.dropdownPanel}>
                  {customerMatches.length === 0 && (
                    <div className={styles.dropdownEmpty}>{customerLoadError || t('newSale.noCustomer')}</div>
                  )}
                  {customerMatches.map((c, index) => {
                    const isHighlighted = index === highlightedCustomerIndex;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`${styles.customerOption} ${isHighlighted ? styles.customerOptionActive : ''}`}
                        aria-selected={isHighlighted}
                        onMouseEnter={() => setHighlightedCustomerIndex(index)}
                        onMouseMove={() => setHighlightedCustomerIndex(index)}
                        onClick={() => selectCustomer(c)}
                      >
                        <MemberAvatar name={c.name} avatarUrl={c.avatarUrl} className={styles.avatar} />
                        <div className={styles.customerChipMeta}>
                          <span className={styles.customerChipName}>{c.name}</span>
                          <span className={styles.customerChipMobile}>
                            {c.mobile} · {c.membershipRank} · {formatNumber(c.points)} {t('newSale.pointsShort')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className={`${styles.metaField} ${styles.pharmacistField}`}>
          <span className={styles.metaLabel}>{t('common.pharmacist')}</span>
          <CustomSelect
            ariaLabel={t('common.pharmacist')}
            value={pharmacistId}
            options={PHARMACISTS.map((pharmacist) => ({ value: pharmacist.id, label: pharmacist.name }))}
            onChange={setPharmacistId}
          />
        </div>
      </div>

      {/* Scrollable body */}
      <div className={styles.scrollArea}>
        {/* Item search */}
        <div className={styles.searchSection} ref={itemFieldRef}>
          <div className={styles.itemSearchField}>
            <IconSearch className={styles.itemSearchIcon} />
            <input
              ref={itemSearchInputRef}
              autoFocus
              type="text"
              value={itemQuery}
              onChange={(e) => { setItemQuery(e.target.value); setItemDropdownOpen(true); }}
              onFocus={() => {
                setItemDropdownOpen(true);
                setHighlightedItemIndex(0);
              }}
              onKeyDown={handleItemSearchKeyDown}
              placeholder={t('newSale.searchItem')}
              className={`${styles.itemSearchInput} ${preferences.showKeyboardHints ? styles.itemSearchInputWithHints : ''}`}
            />
            {preferences.showKeyboardHints && (
              <span className={styles.keyboardHint} aria-hidden="true">
                <kbd>↑↓</kbd> {t('newSale.browse')} <kbd>Enter</kbd> {t('newSale.add')} <kbd>Esc</kbd> {t('newSale.close')}
              </span>
            )}
          </div>
          {itemDropdownOpen && itemQuery.trim() && (
            <div className={styles.itemDropdownPanel}>
              {itemMatches.length === 0 && <div className={styles.dropdownEmpty}>{t('newSale.noItem')}</div>}
              {itemMatches.map((it, index) => {
                const nearest = nearestExpiryBatch(it.batches);
                const totalStock = it.batches.reduce((sum, batch) => sum + batch.stock, 0);
                const isHighlighted = index === highlightedItemIndex;
                const allergyWarning = allergyWarningForItem(it);
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`${styles.itemOption} ${isHighlighted ? styles.itemOptionActive : ''}`}
                    aria-selected={isHighlighted}
                    onMouseEnter={() => setHighlightedItemIndex(index)}
                    onMouseMove={() => setHighlightedItemIndex(index)}
                    onClick={() => openEditorForItem(it)}
                  >
                    <img src={it.image} alt="" className={styles.itemOptionThumb} />
                    <div className={styles.itemOptionMeta}>
                      <span className={styles.itemOptionName}>
                        <span>{it.name}</span>
                        {allergyWarning && <strong className={styles.allergyWarning}>{allergyWarning}</strong>}
                      </span>
                      <span className={styles.itemOptionSub}>{buildProductDescription({
                        brand: it.brand,
                        packLabel: it.packLabel,
                        location: it.loc,
                        totalStock,
                        showLocation: storeSettings.showProductLocation,
                        showStock: preferences.showAvailableStock,
                      })}</span>
                    </div>
                    <span className={styles.itemOptionPrice}>
                      <span>{nearest ? `฿${formatBaht(nearest.sellPrice)}` : t('newSale.outOfStock')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Editor row — staged item awaiting batch confirmation + qty */}
        {editor && (
          <div className={styles.editorBlock} ref={batchPickerRef}>
            <div className={styles.editorRows}>
              <div className={styles.editorPrimaryRow}>
                <button type="button" className={styles.binButton} onClick={() => setEditor(null)} aria-label={t('newSale.cancelItem')}>
                  <IconBin />
                </button>
                <div className={styles.editorField}>
                  <span className={styles.editorFieldLabel}>{t('newSale.item')}</span>
                  <span className={styles.editorItemLine}>
                    <span className={styles.editorItemName} title={editor.item.name}>{editor.item.name}</span>
                    {allergyWarningForItem(editor.item) && (
                      <strong className={styles.allergyWarning}>{allergyWarningForItem(editor.item)}</strong>
                    )}
                  </span>
                  {storeSettings.showProductLocation && (
                    <span className={styles.editorFieldMeta}>{editor.item.loc}</span>
                  )}
                </div>

                <div className={styles.editorField}>
                  <span className={styles.editorFieldLabel}>{t('newSale.pack')}</span>
                  {shouldUseSellPackDropdown(editor.item.sellPacks.length) ? (
                    <CustomSelect
                      ariaLabel={t('newSale.sellUnit')}
                      value={editor.sellPack.key}
                      options={editor.item.sellPacks
                        .filter((pack) => editor.item.batches.some((batch) => availableStockForPack(batch, pack) > 0))
                        .map((pack) => ({ value: pack.key, label: pack.label }))}
                      onChange={(packKey) => {
                        const pack = editor.item.sellPacks.find((candidate) => candidate.key === packKey);
                        if (pack) handleSelectSellPack(pack);
                      }}
                      className={styles.sellPackSelect}
                    />
                  ) : (
                    <span className={styles.singlePackValue} aria-label={t('newSale.sellUnit')} title={editor.sellPack.relationLabel}>
                      {editor.sellPack.label}
                    </span>
                  )}
                </div>

                <div className={styles.editorField}>
                  <span className={styles.editorFieldLabel}>{t('newSale.batch')}</span>
                  <div className={styles.editorBatchControl}>
                    <button
                      type="button"
                      className={styles.batchToggle}
                      onClick={() => setEditor({ ...editor, batchCardOpen: !editor.batchCardOpen })}
                      aria-haspopup="listbox"
                      aria-expanded={editor.batchCardOpen}
                    >
                      <span>{editor.batch.batchNo}</span>
                      <IconChevronDown className={editor.batchCardOpen ? styles.chevronOpen : ''} />
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.editorDivider} aria-hidden="true" />

              <div className={styles.editorSecondaryRow}>
                <div className={styles.editorPriceField}>
                  <strong>฿{formatBaht(sellPriceForPack(editor.batch, editor.sellPack))}</strong>
                </div>
                <label className={styles.editorQuantityField}>
                  <input
                    ref={qtyInputRef}
                    type="text"
                    inputMode="numeric"
                    aria-label={t('newSale.quantityShort')}
                    value={editor.qty}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.preventDefault();
                        setEditor({ ...editor, qty: '' });
                        return;
                      }

                      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        commitEditorToCart();
                      }
                    }}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '');
                      const maxQty = availableStockForPack(editor.batch, editor.sellPack);
                      const clampedQty = digitsOnly
                        ? String(Math.min(maxQty || 1, Math.max(1, parseInt(digitsOnly, 10))))
                        : '';
                      setEditor({ ...editor, qty: clampedQty });
                    }}
                    className={styles.qtyInputSmall}
                  />
                </label>
                <button type="button" className={styles.addButton} onClick={commitEditorToCart}>
                  <span className={styles.addButtonIcon} aria-hidden="true">+</span>
                  <span>{t('newSale.add')}</span>
                </button>
              </div>
            </div>

            {editor.batchCardOpen && (
              <div className={styles.batchCard}>
                <p className={styles.batchCardLabel}>{t('newSale.chooseBatch')}</p>
                <div className={styles.batchOptions} role="listbox" aria-label={t('newSale.batch')}>
                  {editor.item.batches.filter((b) => availableStockForPack(b, editor.sellPack) > 0).map((b) => (
                    <button
                      key={b.batchId}
                      type="button"
                      role="option"
                      aria-selected={b.batchId === editor.batch.batchId}
                      className={`${styles.batchOption} ${b.batchId === editor.batch.batchId ? styles.batchOptionActive : ''}`}
                      onClick={() => handleSelectBatch(b)}
                    >
                      <span className={styles.batchOptionNo}>
                        {b.batchNo}
                        {b.batchId === recommendedBatchId && <span className={styles.recommendedTag}>{t('newSale.nearestExpiry')}</span>}
                      </span>
                      <span className={styles.batchOptionRow}><span className={styles.muted}>{t('newSale.expiryShort')}</span> {formatExpiry(b.exp)}</span>
                      <span className={styles.batchOptionRow}><span className={styles.muted}>{t('newSale.sell')}</span> ฿{formatBaht(sellPriceForPack(b, editor.sellPack))}</span>
                      {preferences.showAvailableStock && (
                        <span className={styles.batchOptionRow}><span className={styles.muted}>{t('nav.stock')}</span> {availableStockForPack(b, editor.sellPack)} {displayPackUnit(editor.sellPack.unit)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cart table */}
        {cartLines.length > 0 && (
          <div className={styles.cartTableWrap}>
            <table className={styles.cartTable}>
              <thead>
                <tr>
                  <th aria-hidden="true" />
                  <th>{t('newSale.item')}</th>
                  <th>{t('newSale.pack')}</th>
                  {storeSettings.showProductLocation && <th>{t('newSale.locationShort')}</th>}
                  <th>{t('newSale.batch')}</th>
                  <th>{t('newSale.expiryShort')}</th>
                  <th className={styles.alignRight}>{t('newSale.price')}</th>
                  <th className={styles.alignRight}>{t('newSale.quantityShort')}</th>
                  <th className={styles.alignRight}>{t('newSale.lineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {cartLines.map((line) => {
                  const catalogItem = catalogItemForLine(line, catalog);
                  const allergyWarning = catalogItem ? allergyWarningForItem(catalogItem) : '';
                  return (
                  <tr key={line.lineId}>
                    <td>
                      <button type="button" className={styles.binButton} onClick={() => removeCartLine(line.lineId)} aria-label={`Remove ${line.itemName}`}>
                        <IconBin />
                      </button>
                    </td>
                    <td className={styles.itemNameCell}>
                      <span className={styles.cartItemName}>{line.itemName}</span>
                      {allergyWarning && <strong className={styles.allergyWarning}>{allergyWarning}</strong>}
                    </td>
                    <td className={styles.packCell}>
                      <span className={styles.packCellUnit}>{line.packLabel}</span>
                    </td>
                    {storeSettings.showProductLocation && <td className={styles.muted}>{line.loc}</td>}
                    <td className={styles.muted}>{line.batch.batchNo}</td>
                    <td className={styles.muted}>{formatExpiry(line.batch.exp)}</td>
                    <td className={styles.alignRight}>฿{formatBaht(line.batch.sellPrice * line.packMultiplier)}</td>
                    <td className={styles.alignRight}>
                      <div className={styles.qtyStepper}>
                        <button
                          type="button"
                          className={styles.qtyStepButton}
                          onClick={() => updateCartQty(line.lineId, line.qty - 1)}
                          aria-label={`Decrease ${line.itemName} quantity`}
                        >
                          -
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cartQtyDrafts[line.lineId] ?? String(line.qty)}
                          onFocus={(e) => e.currentTarget.select()}
                          onBlur={() => {
                            setCartQtyDrafts((prev) => {
                              if (prev[line.lineId] !== '') return prev;
                              const next = { ...prev };
                              delete next[line.lineId];
                              return next;
                            });
                          }}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D/g, '');
                            if (!digitsOnly) {
                              setCartQtyDrafts((prev) => ({ ...prev, [line.lineId]: '' }));
                              return;
                            }
                            setCartQtyDrafts((prev) => ({ ...prev, [line.lineId]: digitsOnly }));
                            updateCartQty(line.lineId, parseInt(digitsOnly, 10));
                          }}
                          className={styles.qtyStepperInput}
                        />
                        <button
                          type="button"
                          className={styles.qtyStepButton}
                          onClick={() => updateCartQty(line.lineId, line.qty + 1)}
                          aria-label={`Increase ${line.itemName} quantity`}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className={styles.alignRight}>
                      <span className={styles.lineTotal}>฿{formatBaht(line.qty * line.batch.sellPrice * line.packMultiplier)}</span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Top items rail */}
        {topItems.length > 0 && (
          <div className={styles.topItemsSection}>
            <div className={styles.topItemsRail}>
              {topItems.map((it) => {
                const nearest = nearestExpiryBatch(it.batches);
                const productDescription = buildProductDescription({
                  brand: it.brand,
                  packLabel: it.packLabel,
                  location: it.loc,
                  totalStock: it.batches.reduce((sum, batch) => sum + batch.stock, 0),
                  showLocation: storeSettings.showProductLocation,
                  showStock: preferences.showAvailableStock,
                });
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={styles.topItemCard}
                    onMouseDown={() => startHold(it.id)}
                    onMouseUp={endHold}
                    onMouseLeave={endHold}
                    onTouchStart={() => startHold(it.id)}
                    onTouchEnd={endHold}
                    onClick={() => handleTopItemTap(it)}
                  >
                    <img src={it.image} alt={it.name} className={styles.topItemImage} />
                    <span className={styles.topItemDetail} aria-hidden="true">
                      <span className={styles.topItemDetailName}>{it.name}</span>
                      <span className={styles.topItemDetailSub}>{productDescription}</span>
                      <span className={styles.topItemDetailBottom}>
                        <span>{nearest ? `฿${formatBaht(nearest.sellPrice)}` : t('newSale.outOfStock')}</span>
                      </span>
                    </span>
                    {heldItemId === it.id && (
                      <div className={styles.topItemTouchPreview}>
                        <span className={styles.topItemDetailName}>{it.name}</span>
                        <span className={styles.topItemDetailSub}>{productDescription}</span>
                        <span className={styles.topItemDetailBottom}>
                          <span>{nearest ? `฿${formatBaht(nearest.sellPrice)}` : t('newSale.outOfStock')}</span>
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className={styles.topItemsLabel}>{topItemsLabel}</p>
          </div>
        )}
      </div>

      {/* Bottom summary bar */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryStat}>
          <span className={styles.summaryStatLabel}>{t('newSale.totalQuantity')}</span>
          <span className={styles.summaryStatValue}>{totalQty}</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryStat}>
          <span className={styles.summaryStatLabel}>{t('newSale.uniqueItems')}</span>
          <span className={styles.summaryStatValue}>{uniqueItemCount}</span>
        </div>
        <div className={styles.summaryDivider} />
        <button
          type="button"
          className={styles.netPayableCell}
          onClick={openDiscountDrawer}
          disabled={!canOpenInvoiceBreakdown}
          aria-disabled={!canOpenInvoiceBreakdown}
        >
          <span className={styles.summaryStatLabel}>
            {t('sales.netTotal')} {appliedDiscount && <span className={styles.discountBadge}>{t('newSale.discountApplied')}</span>}
            {preferences.showKeyboardHints && <kbd className={styles.netPayableShortcut}>Ctrl + Enter</kbd>}
          </span>
          <span className={styles.netPayableValue}>฿{formatBaht(netPayable)}</span>
        </button>
      </div>

      {/* Pill reminder */}
      {reminderOpen && (
        <div className={styles.reminderBackdrop} onClick={() => setReminderOpen(false)}>
          <div className={styles.reminderCard} role="dialog" aria-modal="true" aria-labelledby="pill-reminder-title" onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2 id="pill-reminder-title" className={styles.drawerTitle}>{t('newSale.pillReminder')}</h2>
              <button type="button" className={styles.drawerClose} onClick={() => setReminderOpen(false)} aria-label={t('newSale.closeReminder')}>
                <IconClose />
              </button>
            </div>

            {reminderEligibleLines.length === 0 ? (
              <div className={styles.reminderEmpty}>{t('newSale.noReminderItems')}</div>
            ) : (
              <div className={styles.reminderTableWrap}>
                <table className={styles.reminderTable}>
                  <thead>
                    <tr>
                      <th>{t('newSale.drugItem')}</th>
                      {REMINDER_TIMES.map((time) => (
                        <th key={time.label}>
                          <span className={styles.reminderTimeHead}>
                            <img src={time.icon} alt={time.label} className={styles.reminderTimeIcon} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reminderEligibleLines.map((line) => {
                      const catalogItem = catalog.find((item) => item.id === line.itemId);
                      const reminder = reminderRows[line.lineId] ?? createDefaultReminder();
                      const totalTabs = totalTabsForLine(line, catalog);
                      return (
                        <tr key={line.lineId} className={!reminder.enabled ? styles.reminderRowMuted : ''}>
                          <td>
                            <label className={styles.reminderDrug}>
                              <input
                                type="checkbox"
                                checked={reminder.enabled}
                                onChange={() => toggleReminderLine(line.lineId)}
                              />
                              <span className={styles.reminderDrugText}>
                                <span className={styles.reminderDrugName}>{line.itemName}</span>
                                <span className={styles.reminderDrugSub}>
                                  {t('newSale.tabsTotal', { count: formatNumber(totalTabs) })} | {catalogItem?.packLabel ?? line.packLabel} | {line.packLabel}
                                  {storeSettings.showProductLocation ? ` | ${line.loc}` : ''}
                                </span>
                              </span>
                            </label>
                          </td>
                          {REMINDER_TIMES.map((time, index) => (
                            <td key={time.label}>
                              <button
                                type="button"
                                className={`${styles.reminderDoseButton} ${reminder.activeTime === index ? styles.reminderDoseButtonActive : ''}`}
                                data-reminder-line={line.lineId}
                                data-reminder-time={index}
                                onClick={() => setReminderTime(line.lineId, index)}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowLeft') {
                                    e.preventDefault();
                                    navigateReminderTime(line.lineId, index, -1);
                                    return;
                                  }
                                  if (e.key === 'ArrowRight') {
                                    e.preventDefault();
                                    navigateReminderTime(line.lineId, index, 1);
                                    return;
                                  }
                                  if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    changeReminderDose(line.lineId, index, 1);
                                    return;
                                  }
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    changeReminderDose(line.lineId, index, -1);
                                  }
                                }}
                                disabled={!reminder.enabled}
                                aria-label={`${line.itemName}, ${time.label}, ${reminder.doses[index]} tab`}
                              >
                                {reminder.doses[index]}
                              </button>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sale settings */}
      {settingsOpen && (
        <div className={styles.settingsBackdrop} onClick={() => setSettingsOpen(false)}>
          <div className={styles.settingsPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>{t('newSale.settings')}</h2>
              <button type="button" className={styles.drawerClose} onClick={() => setSettingsOpen(false)} aria-label={t('newSale.close')}>
                <IconClose />
              </button>
            </div>

            <p className={styles.drawerSectionLabel}>{t('newSale.billingDevice')}</p>
            <div className={styles.settingsField}>
              <span className={styles.settingsLabel}>{t('newSale.receiptPrinter')}</span>
              <CustomSelect
                ariaLabel={t('newSale.receiptPrinter')}
                value={billingDevice}
                options={[
                  { value: 'Front Counter Thermal Printer', label: 'Front Counter Thermal Printer' },
                  { value: 'Back Counter Thermal Printer', label: 'Back Counter Thermal Printer' },
                  { value: 'PDF Preview Only', label: 'PDF Preview Only' },
                  { value: 'USB Receipt Printer', label: 'USB Receipt Printer' },
                ]}
                onChange={setBillingDevice}
                className={styles.settingsCustomSelect}
              />
            </div>

            <div className={styles.settingsField}>
              <span className={styles.settingsLabel}>{t('newSale.paperSize')}</span>
              <CustomSelect
                ariaLabel={t('newSale.paperSize')}
                value={paperSize}
                options={[
                  { value: '80mm thermal', label: '80mm thermal' },
                  { value: '58mm thermal', label: '58mm thermal' },
                  { value: 'A5 invoice', label: 'A5 invoice' },
                  { value: 'A4 invoice', label: 'A4 invoice' },
                ]}
                onChange={setPaperSize}
                className={styles.settingsCustomSelect}
              />
            </div>

            <div className={styles.settingsField}>
              <span className={styles.settingsLabel}>{t('newSale.cashDrawer')}</span>
              <CustomSelect
                ariaLabel={t('newSale.cashDrawer')}
                value={cashDrawerDevice}
                options={[
                  { value: 'Front Counter Cash Drawer', label: 'Front Counter Cash Drawer' },
                  { value: 'Back Counter Cash Drawer', label: 'Back Counter Cash Drawer' },
                  { value: 'Printer-connected Drawer', label: 'Printer-connected Drawer' },
                  { value: 'No Cash Drawer', label: 'No Cash Drawer' },
                ]}
                onChange={setCashDrawerDevice}
                className={styles.settingsCustomSelect}
              />
            </div>

            <label className={styles.settingsToggle}>
              <span>
                <span className={styles.settingsLabel}>{t('newSale.autoPrint')}</span>
                <span className={styles.settingsHelp}>{t('newSale.autoPrintHint')}</span>
              </span>
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
              />
            </label>

            <label className={styles.settingsToggle}>
              <span>
                <span className={styles.settingsLabel}>{t('newSale.autoDrawer')}</span>
                <span className={styles.settingsHelp}>{t('newSale.autoDrawerHint')}</span>
              </span>
              <input
                type="checkbox"
                checked={autoOpenCashDrawer}
                onChange={(e) => setAutoOpenCashDrawer(e.target.checked)}
              />
            </label>

            <div className={styles.devicePreview}>
              <span className={styles.muted}>{t('newSale.currentSetup')}</span>
              <strong>{billingDevice}</strong>
              <span>{paperSize} | {autoPrint ? t('pos.on') : t('pos.off')}</span>
              <span>{cashDrawerDevice} | {autoOpenCashDrawer ? t('pos.on') : t('pos.off')}</span>
            </div>

            <div className={styles.drawerActions}>
              <button type="button" className={styles.drawerPrimaryBtn} onClick={() => setSettingsOpen(false)}>{t('newSale.done')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Discount drawer */}
      {discountOpen && (
        <div className={styles.drawerBackdrop} onClick={() => setDiscountOpen(false)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>{t('newSale.invoiceBreakdown')}</h2>
              <button type="button" className={styles.drawerClose} onClick={() => setDiscountOpen(false)} aria-label={t('newSale.close')}>
                <IconClose />
              </button>
            </div>

            <div className={styles.drawerRow}>
              <span className={styles.muted}>{t('newSale.subtotal')}</span>
              <span>฿{formatBaht(subtotal)}</span>
            </div>
            <div className={styles.drawerRow}>
              <span className={styles.muted}>{t('newSale.currentDiscount')}</span>
              <span>฿{formatBaht(discountAmount)}</span>
            </div>

            <p className={styles.drawerSectionLabel}>{t('newSale.billDiscount')}</p>
            <div className={styles.discountTypeToggle}>
              <button
                type="button"
                className={`${styles.discountTypeBtn} ${discountType === 'percent' ? styles.discountTypeBtnActive : ''}`}
                onClick={() => setDiscountType('percent')}
              >
                %
              </button>
              <button
                type="button"
                className={`${styles.discountTypeBtn} ${discountType === 'thb' ? styles.discountTypeBtnActive : ''}`}
                onClick={() => setDiscountType('thb')}
              >
                ฿
              </button>
            </div>
            <input
              type="number"
              min={0}
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
              className={styles.discountInput}
            />

            <div className={styles.drawerRow}>
              <span className={styles.muted}>{t('sales.netTotal')}</span>
              <span className={styles.drawerNetPayable}>
                ฿{formatBaht(draftNetPayable)}
              </span>
            </div>

            <p className={styles.drawerSectionLabel}>{t('newSale.customerPay')}</p>
            <input
              ref={customerPayInputRef}
              type="number"
              min={0}
              value={customerPayInput}
              onChange={(e) => {
                setSaleSubmitError('');
                setCustomerPayEdited(true);
                setCustomerPayInput(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCustomerPayEnter();
                }
              }}
              placeholder={t('newSale.keyPaid')}
              className={styles.customerPayInput}
            />

            {paymentMethod === 'Cash' && (
              <div className={styles.cashNoteRow} aria-label={t('newSale.quickCash')}>
                {[
                  { amount: 100, className: styles.cashNote100 },
                  { amount: 500, className: styles.cashNote500 },
                  { amount: 1000, className: styles.cashNote1000 },
                ].map(({ amount, className }) => (
                  <button
                    key={amount}
                    type="button"
                    className={`${styles.cashNoteButton} ${className}`}
                    onClick={() => addCustomerCash(amount)}
                    aria-label={t('newSale.addBaht', { amount })}
                  >
                    <span className={styles.cashNoteGraphic} aria-hidden="true">
                      <span className={styles.cashNoteSeal}>฿</span>
                      <span className={styles.cashNoteLines}>
                        <span />
                        <span />
                        <span />
                      </span>
                    </span>
                    <strong>{amount}</strong>
                  </button>
                ))}
              </div>
            )}

            <div className={styles.changePanel}>
              <span className={styles.muted}>{t('newSale.change')}</span>
              <strong>฿{formatBaht(liveChangeDue)}</strong>
            </div>

            <div className={styles.cashDrawerStatus}>
              <span className={styles.cashDrawerDot} />
              <span>
                {autoOpenCashDrawer
                  ? `Cash drawer auto open: ${cashDrawerDevice}`
                  : 'Cash drawer auto open: off'}
              </span>
            </div>

            {saleSubmitError && (
              <div className={styles.drawerError} role="alert">
                {saleSubmitError}
              </div>
            )}

            <div className={styles.drawerActions}>
              {appliedDiscount && (
                <button type="button" className={styles.drawerSecondaryBtn} onClick={clearDiscount}>{t('newSale.removeDiscount')}</button>
              )}
              <button type="button" className={styles.drawerPrimaryBtn} onClick={() => void submitInvoicePayment()} disabled={saleSubmitting}>
                {saleSubmitting ? t('newSale.submitting') : t('newSale.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceCreated && (
        <div className={styles.invoiceCreatedBackdrop}>
          <div className={styles.invoiceCreatedCard} role="status" aria-live="polite">
            <div className={styles.invoiceCreatedIcon}>
              <IconTick />
            </div>
            <h2 className={styles.invoiceCreatedTitle}>{t('newSale.invoiceCreated')}</h2>
            <p className={styles.invoiceCreatedSub}>{t('newSale.paymentReceived')}</p>

            <div className={styles.invoiceCreatedDetails}>
              <div className={styles.invoiceCreatedRow}>
                <span>{t('newSale.invoiceNo')}</span>
                <strong className={styles.invoiceCreatedNo}>{invoiceCreated.invoiceNo}</strong>
              </div>
              <div className={styles.invoiceCreatedRow}>
                <span>{t('newSale.amountPaid')}</span>
                <strong>฿{formatBaht(invoiceCreated.amountPaid)}</strong>
              </div>
              <div className={styles.invoiceCreatedRow}>
                <span>{t('sales.netTotal')}</span>
                <strong>฿{formatBaht(invoiceCreated.netTotal)}</strong>
              </div>
              <div className={styles.invoiceCreatedRow}>
                <span>{t('newSale.change')}</span>
                <strong>฿{formatBaht(invoiceCreated.changeDue)}</strong>
              </div>
              <div className={styles.invoiceCreatedRow}>
                <span>{t('newSale.method')}</span>
                <strong>{paymentMethodLabel(invoiceCreated.paymentMode as StorePaymentMethod)}</strong>
              </div>
              <div className={styles.invoiceCreatedRow}>
                <span>{t('newSale.time')}</span>
                <strong className={styles.invoiceCreatedTime}>
                  {formatDate(invoiceCreated.createdAt, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className={styles.printReceiptBtn}
              onClick={() => console.log('Print receipt', invoiceCreated)}
            >
              <IconPrint />
              {t('newSale.printReceipt')}
            </button>
            <button ref={newSaleButtonRef} type="button" className={styles.newSaleBtn} onClick={resetForNewWalkIn}>
              <span className={styles.newSaleBtnIcon} aria-hidden="true">+</span>
              <span>{t('newSale.new')}</span>
            </button>
          </div>
        </div>
      )}

      <PosConfirmationDialog
        open={pendingConfirmation !== null}
        title={pendingConfirmation?.kind === 'remove-item' ? t('newSale.removeQuestion') : t('newSale.cancelQuestion')}
        description={pendingConfirmation?.kind === 'remove-item'
          ? t('newSale.removeDescription', { name: pendingConfirmation.itemName })
          : t('newSale.cancelDescription')}
        confirmLabel={pendingConfirmation?.kind === 'remove-item' ? t('newSale.removeItem') : t('newSale.cancelSale')}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={confirmPendingAction}
      />
    </div>
  );
}
