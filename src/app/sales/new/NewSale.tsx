"use client";

import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import styles from './NewSale.module.css';
import type { ParentPack, ProductPack, SalesProduct } from '@/server/db/types';
import { loadStockCatalog, updateStockCatalog } from '@/app/stock/stockCatalogClient';
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
  isMember: boolean;
  points: number;
  membershipRank: 'Platinum' | 'Gold' | 'Silver' | 'Regular';
  topItemIds?: string[]; // this customer's personal top-10 purchased items
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
};

type InvoiceCreated = {
  invoiceNo: string;
  amountPaid: number;
  changeDue: number;
  paymentMode: string;
  createdAt: string;
};

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
  { label: '8 AM', icon: morningReminderIcon.src },
  { label: '1 PM', icon: noonReminderIcon.src },
  { label: '7 PM', icon: eveningReminderIcon.src },
  { label: '10 PM', icon: nightReminderIcon.src },
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

const PAYMENT_METHODS = ['Cash', 'PromptPay', 'Credit card', 'Bank transfer'];
const SAVED_SALES_KEY = 'pharm_recent_sales';

const PHARMACISTS: Pharmacist[] = [
  { id: 'p1', name: 'Ph. Nattaya S.' },
  { id: 'p2', name: 'Ph. Somchai T.' },
  { id: 'p3', name: 'Ph. Kanokwan R.' },
];

const CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Suchada Wong', mobile: '081-234-5566', isMember: true, points: 4280, membershipRank: 'Platinum', topItemIds: ['p-sara', 'p-tiffy', 'p-airx', 'p-gaviscon', 'p-betadine'] },
  { id: 'c2', name: 'Kridsada Phan', mobile: '089-771-2201', isMember: true, points: 2150, membershipRank: 'Gold', topItemIds: ['p-blackmores-c', 'p-natc', 'p-nivea-sun', 'p-dentiste', 'p-nexcare'] },
  { id: 'c3', name: 'Areeya Somboon', mobile: '086-005-9981', isMember: true, points: 980, membershipRank: 'Silver', topItemIds: ['p-zyrtec', 'p-tylenol', 'p-ors', 'p-smooth-e'] },
  { id: 'c4', name: 'Natthapong Lee', mobile: '090-441-7723', isMember: true, points: 310, membershipRank: 'Regular', topItemIds: ['p-gaviscon', 'p-sara', 'p-durex'] },
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

function formatExp(value: string): string {
  const date = parseExpiryDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
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

/** Supports barcode, product name, brand, manufacturer, pack, and "c, <term>" category search. */
function matchesQuery(item: CatalogItem, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return false;

  if (q.startsWith('c,') || q.startsWith('c ')) {
    const term = q.slice(2).trim();
    return term.length === 0 || item.category.toLowerCase().includes(term);
  }
  if (/^\d{5,}$/.test(q)) {
    return item.barcode.includes(q);
  }
  return (
    item.name.toLowerCase().includes(q) ||
    item.brand.toLowerCase().includes(q) ||
    item.manufacturer.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q) ||
    item.packLabel.toLowerCase().includes(q) ||
    item.sellPacks.some((pack) => pack.unit.toLowerCase().startsWith(q))
  );
}

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
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
        <span className={styles.customSelectValue}>{selected?.label ?? ''}</span>
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
              {option.label}
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

export default function NewSale(): React.ReactElement {
  const router = useRouter();

  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editingBillNo, setEditingBillNo] = useState<string | null>(null);

  // Row 1 — toolbar
  const [ownerId, setOwnerId] = useState(OWNERS[0].id);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [purchaseMethod, setPurchaseMethod] = useState<PurchaseMethod>('pickup');
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const saveMenuRef = useClickOutside<HTMLDivElement>(() => setSaveMenuOpen(false));

  // Row 2 — bill meta
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pharmacistId, setPharmacistId] = useState(PHARMACISTS[0].id);
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

  /* ── Derived values ─────────────────────────────────────────────── */

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return CUSTOMERS;
    return CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q) || c.mobile.replace(/-/g, '').includes(q.replace(/-/g, '')));
  }, [customerQuery]);

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
    return catalog.filter((it) => matchesQuery(it, q)).slice(0, 8);
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

  const topItemsLabel = customer && customer.isMember ? `Top picks for ${customer.name.split(' ')[0]}` : 'Top 10 Thai products this week';

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
    const billId = new URLSearchParams(window.location.search).get('billId');
    if (!billId) return;

    async function loadPendingBill() {
      try {
        const response = await fetch('/api/sales', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load pending sale.');
        const data = await response.json() as { sales?: SavedSale[] };
        const savedBill = data.sales?.find((bill) => bill.id === billId && bill.status === 'pending');
        if (cancelled || !savedBill || !Array.isArray(savedBill.lines) || savedBill.lines.length === 0) return;

        setEditingBillId(savedBill.id);
        setEditingBillNo(savedBill.billNo);
        setOwnerId(savedBill.ownerId ?? OWNERS[0].id);
        setPaymentMethod(savedBill.paymentMethod ?? PAYMENT_METHODS[0]);
        setPurchaseMethod(savedBill.purchaseMethod ?? 'pickup');
        setBillDate(savedBill.billDate ?? savedBill.date.slice(0, 10));
        setPharmacistId(savedBill.pharmacistId ?? PHARMACISTS[0].id);
        setCustomer(CUSTOMERS.find((c) => c.id === savedBill.customerId) ?? null);
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
  }, []);

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

    if (event.key === 'Enter') {
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

    if (event.key === 'Enter') {
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

  function removeCartLine(lineId: string) {
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
      router.push('/sales');
    } catch (error) {
      setSaleSubmitError(error instanceof Error ? error.message : 'Unable to save this sale.');
      setSaleSubmitting(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <div className={styles.page}>
      {/* Row 1 — toolbar */}
      <div className={styles.toolbarRow}>
        <div className={styles.breadcrumb}>
          <button type="button" className={styles.breadcrumbLink} onClick={() => router.push('/sales')}>Sales</button>
          <span className={styles.breadcrumbSep}>&gt;</span>
          <span className={styles.breadcrumbCurrent}>New sale</span>
        </div>

        <div className={styles.toolbarControls}>
          <CustomSelect
            ariaLabel="Owner"
            value={ownerId}
            options={OWNERS.map((owner) => ({ value: owner.id, label: owner.name }))}
            onChange={setOwnerId}
          />

          <CustomSelect
            ariaLabel="Payment method"
            value={paymentMethod}
            options={PAYMENT_METHODS.map((method) => ({ value: method, label: method }))}
            onChange={setPaymentMethod}
          />

          <button
            type="button"
            className={styles.reminderButton}
            onClick={openReminderCard}
            aria-haspopup="dialog"
          >
            <IconPill />
            <span>Reminder</span>
          </button>

          <button
            type="button"
            className={`${styles.fulfilmentToggle} ${purchaseMethod === 'delivery' ? styles.fulfilmentToggleDelivery : ''}`}
            onClick={() => setPurchaseMethod((current) => (current === 'pickup' ? 'delivery' : 'pickup'))}
            aria-label="Toggle fulfilment method"
            aria-pressed={purchaseMethod === 'delivery'}
          >
            <span className={styles.fulfilmentLabel}>{purchaseMethod === 'pickup' ? 'Pickup' : 'Delivery'}</span>
            <span className={styles.fulfilmentSwitch} aria-hidden="true">
              <span className={styles.fulfilmentSwitchThumb} />
            </span>
          </button>

          <div className={styles.saveSplit} ref={saveMenuRef}>
            <button type="button" className={styles.saveMain} onClick={() => handleSave('save')} disabled={!canSaveSale}>
              Save
            </button>
            <button
              type="button"
              className={styles.saveChevron}
              onClick={() => setSaveMenuOpen((v) => !v)}
              disabled={!canSaveSale}
              aria-haspopup="menu"
              aria-expanded={saveMenuOpen}
              aria-label="More save options"
            >
              <IconChevronDown />
            </button>
            {saveMenuOpen && (
              <div className={styles.saveMenu} role="menu">
                <button type="button" role="menuitem" className={styles.saveMenuItem} onClick={() => handleSave('save')} disabled={!canSaveSale}>Save as pending</button>
                <button type="button" role="menuitem" className={styles.saveMenuItem} onClick={() => handleSave('save-new')} disabled={!canSaveSale}>Save pending &amp; new</button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.gearButton}
            title="Sale settings"
            aria-label="Sale settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Row 2 — bill meta */}
      <div className={styles.metaRow}>
        <label className={`${styles.metaField} ${styles.dateField}`}>
          <span className={styles.metaLabel}>Bill date</span>
          <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={styles.dateInput} />
        </label>

        <div className={`${styles.metaField} ${styles.customerField}`} ref={customerFieldRef}>
          <span className={styles.metaLabel}>Customer</span>
          {customer ? (
            <div className={styles.customerChip}>
              <span className={styles.avatar}>{initials(customer.name)}</span>
              <div className={styles.customerChipMeta}>
                <span className={styles.customerChipName}>{customer.name}</span>
                <span className={styles.customerChipMobile}>
                  {customer.mobile} · {customer.membershipRank} · {customer.points.toLocaleString('en-US')} pts
                </span>
              </div>
              <button
                type="button"
                className={styles.clearChip}
                onClick={() => { setCustomer(null); setCustomerQuery(''); }}
                aria-label="Clear customer"
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
                placeholder="Search name or mobile number"
                className={styles.textInput}
              />
              {customerDropdownOpen && (
                <div className={styles.dropdownPanel}>
                  {customerMatches.length === 0 && (
                    <div className={styles.dropdownEmpty}>No customer found — sale will be walk-in.</div>
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
                        <span className={styles.avatar}>{initials(c.name)}</span>
                        <div className={styles.customerChipMeta}>
                          <span className={styles.customerChipName}>{c.name}</span>
                          <span className={styles.customerChipMobile}>
                            {c.mobile} · {c.membershipRank} · {c.points.toLocaleString('en-US')} pts
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
          <span className={styles.metaLabel}>Pharmacist</span>
          <CustomSelect
            ariaLabel="Pharmacist"
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
              type="text"
              value={itemQuery}
              onChange={(e) => { setItemQuery(e.target.value); setItemDropdownOpen(true); }}
              onFocus={() => {
                setItemDropdownOpen(true);
                setHighlightedItemIndex(0);
              }}
              onKeyDown={handleItemSearchKeyDown}
              placeholder="Search item — barcode, product name, etc."
              className={styles.itemSearchInput}
            />
          </div>
          {itemDropdownOpen && itemQuery.trim() && (
            <div className={styles.itemDropdownPanel}>
              {itemMatches.length === 0 && <div className={styles.dropdownEmpty}>No matching item.</div>}
              {itemMatches.map((it, index) => {
                const nearest = nearestExpiryBatch(it.batches);
                const isHighlighted = index === highlightedItemIndex;
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
                      <span className={styles.itemOptionName}>{it.name}</span>
                      <span className={styles.itemOptionSub}>{it.brand} · {it.packLabel} · {it.loc}</span>
                    </div>
                    <span className={styles.itemOptionPrice}>
                      {nearest ? `฿${formatBaht(nearest.sellPrice)}` : 'Out of stock'}
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
            <div className={styles.editorRow}>
              <button type="button" className={styles.binButton} onClick={() => setEditor(null)} aria-label="Cancel adding item">
                <IconBin />
              </button>
              <span className={styles.itemNameCell}>{editor.item.name}</span>
              <span className={styles.packChoice} aria-label="Sell unit">
                {editor.item.sellPacks.map((pack) => {
                  const hasStockForPack = editor.item.batches.some((batch) => availableStockForPack(batch, pack) > 0);
                  return (
                    <button
                      key={pack.key}
                      type="button"
                      className={`${styles.packButton} ${pack.key === editor.sellPack.key ? styles.packButtonActive : ''}`}
                      onClick={() => handleSelectSellPack(pack)}
                      title={pack.relationLabel}
                      disabled={!hasStockForPack}
                    >
                      {pack.label}
                    </button>
                  );
                })}
              </span>
              <span className={styles.muted}>{editor.item.loc}</span>
              <button
                type="button"
                className={styles.batchToggle}
                onClick={() => setEditor({ ...editor, batchCardOpen: !editor.batchCardOpen })}
              >
                {editor.batch.batchNo}
                <IconChevronDown className={editor.batchCardOpen ? styles.chevronOpen : ''} />
              </button>
              <span className={styles.muted}>{formatExp(editor.batch.exp)}</span>
              <span className={styles.alignRight}>฿{formatBaht(sellPriceForPack(editor.batch, editor.sellPack))}</span>
              <input
                ref={qtyInputRef}
                type="text"
                inputMode="numeric"
                value={editor.qty}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                    setEditor({ ...editor, qty: '' });
                    return;
                  }

                  if (e.key === 'Enter') {
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
              <button type="button" className={styles.addButton} onClick={commitEditorToCart}>
                <span className={styles.addButtonIcon} aria-hidden="true">+</span>
                <span>Add</span>
              </button>
            </div>

            {editor.batchCardOpen && (
              <div className={styles.batchCard}>
                <p className={styles.batchCardLabel}>Choose a batch — nearest expiry is pre-selected</p>
                <div className={styles.batchOptions}>
                  {editor.item.batches.filter((b) => availableStockForPack(b, editor.sellPack) > 0).map((b) => (
                    <button
                      key={b.batchId}
                      type="button"
                      className={`${styles.batchOption} ${b.batchId === editor.batch.batchId ? styles.batchOptionActive : ''}`}
                      onClick={() => handleSelectBatch(b)}
                    >
                      <span className={styles.batchOptionNo}>
                        {b.batchNo}
                        {b.batchId === recommendedBatchId && <span className={styles.recommendedTag}>Nearest exp.</span>}
                      </span>
                      <span className={styles.batchOptionRow}><span className={styles.muted}>Exp.</span> {formatExp(b.exp)}</span>
                      <span className={styles.batchOptionRow}><span className={styles.muted}>Sell</span> ฿{formatBaht(sellPriceForPack(b, editor.sellPack))}</span>
                      <span className={styles.batchOptionRow}><span className={styles.muted}>Stock</span> {availableStockForPack(b, editor.sellPack)} {displayPackUnit(editor.sellPack.unit)}</span>
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
                  <th>Item</th>
                  <th>Pack</th>
                  <th>Loc.</th>
                  <th>Batch</th>
                  <th>Exp.</th>
                  <th className={styles.alignRight}>Price</th>
                  <th className={styles.alignRight}>Qty.</th>
                  <th className={styles.alignRight}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {cartLines.map((line) => (
                  <tr key={line.lineId}>
                    <td>
                      <button type="button" className={styles.binButton} onClick={() => removeCartLine(line.lineId)} aria-label={`Remove ${line.itemName}`}>
                        <IconBin />
                      </button>
                    </td>
                    <td className={styles.itemNameCell}>{line.itemName}</td>
                    <td className={styles.packCell}>
                      <span className={styles.packCellUnit}>{line.packLabel}</span>
                    </td>
                    <td className={styles.muted}>{line.loc}</td>
                    <td className={styles.muted}>{line.batch.batchNo}</td>
                    <td className={styles.muted}>{formatExp(line.batch.exp)}</td>
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
                ))}
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
                      <span className={styles.topItemDetailSub}>{it.brand} | {it.packLabel} | {it.loc}</span>
                      <span className={styles.topItemDetailBottom}>
                        <span>{nearest ? `฿${formatBaht(nearest.sellPrice)}` : 'Out of stock'}</span>
                        <span>{nearest ? `Stock ${nearest.stock} ${displayPackUnit(it.packUnit)}` : 'Stock 0'}</span>
                      </span>
                    </span>
                    {heldItemId === it.id && (
                      <div className={styles.topItemTouchPreview}>
                        <span className={styles.topItemDetailName}>{it.name}</span>
                        <span className={styles.topItemDetailSub}>{it.brand} | {it.packLabel} | {it.loc}</span>
                        <span className={styles.topItemDetailBottom}>
                          <span>{nearest ? `฿${formatBaht(nearest.sellPrice)}` : 'Out of stock'}</span>
                          <span>{nearest ? `Stock ${nearest.stock} ${displayPackUnit(it.packUnit)}` : 'Stock 0'}</span>
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
          <span className={styles.summaryStatLabel}>Total qty.</span>
          <span className={styles.summaryStatValue}>{totalQty}</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryStat}>
          <span className={styles.summaryStatLabel}>Unique items</span>
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
            Net payable {appliedDiscount && <span className={styles.discountBadge}>discount applied</span>}
          </span>
          <span className={styles.netPayableValue}>฿{formatBaht(netPayable)}</span>
        </button>
      </div>

      {/* Pill reminder */}
      {reminderOpen && (
        <div className={styles.reminderBackdrop} onClick={() => setReminderOpen(false)}>
          <div className={styles.reminderCard} role="dialog" aria-modal="true" aria-labelledby="pill-reminder-title" onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2 id="pill-reminder-title" className={styles.drawerTitle}>Pill Reminder</h2>
              <button type="button" className={styles.drawerClose} onClick={() => setReminderOpen(false)} aria-label="Close pill reminder">
                <IconClose />
              </button>
            </div>

            {reminderEligibleLines.length === 0 ? (
              <div className={styles.reminderEmpty}>No tablet or caplet items in this bill.</div>
            ) : (
              <div className={styles.reminderTableWrap}>
                <table className={styles.reminderTable}>
                  <thead>
                    <tr>
                      <th>Drug Item</th>
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
                                  {totalTabs.toLocaleString('en-US')} tabs total | {catalogItem?.packLabel ?? line.packLabel} | {line.packLabel} | {line.loc}
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
              <h2 className={styles.drawerTitle}>Sale settings</h2>
              <button type="button" className={styles.drawerClose} onClick={() => setSettingsOpen(false)} aria-label="Close">
                <IconClose />
              </button>
            </div>

            <p className={styles.drawerSectionLabel}>Billing device</p>
            <div className={styles.settingsField}>
              <span className={styles.settingsLabel}>Receipt printer</span>
              <CustomSelect
                ariaLabel="Receipt printer"
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
              <span className={styles.settingsLabel}>Paper size</span>
              <CustomSelect
                ariaLabel="Paper size"
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
              <span className={styles.settingsLabel}>Cash drawer</span>
              <CustomSelect
                ariaLabel="Cash drawer"
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
                <span className={styles.settingsLabel}>Auto print after Save & Print</span>
                <span className={styles.settingsHelp}>Uses the selected billing device when the sale is saved.</span>
              </span>
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
              />
            </label>

            <label className={styles.settingsToggle}>
              <span>
                <span className={styles.settingsLabel}>Auto open cash drawer after payment</span>
                <span className={styles.settingsHelp}>Uses the selected cash drawer when Customer pay is enough.</span>
              </span>
              <input
                type="checkbox"
                checked={autoOpenCashDrawer}
                onChange={(e) => setAutoOpenCashDrawer(e.target.checked)}
              />
            </label>

            <div className={styles.devicePreview}>
              <span className={styles.muted}>Current setup</span>
              <strong>{billingDevice}</strong>
              <span>{paperSize} {autoPrint ? '| auto print on' : '| auto print off'}</span>
              <span>{cashDrawerDevice} {autoOpenCashDrawer ? '| drawer auto open on' : '| drawer auto open off'}</span>
            </div>

            <div className={styles.drawerActions}>
              <button type="button" className={styles.drawerPrimaryBtn} onClick={() => setSettingsOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Discount drawer */}
      {discountOpen && (
        <div className={styles.drawerBackdrop} onClick={() => setDiscountOpen(false)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>Invoice breakdown</h2>
              <button type="button" className={styles.drawerClose} onClick={() => setDiscountOpen(false)} aria-label="Close">
                <IconClose />
              </button>
            </div>

            <div className={styles.drawerRow}>
              <span className={styles.muted}>Subtotal</span>
              <span>฿{formatBaht(subtotal)}</span>
            </div>
            <div className={styles.drawerRow}>
              <span className={styles.muted}>Current discount</span>
              <span>฿{formatBaht(discountAmount)}</span>
            </div>

            <p className={styles.drawerSectionLabel}>Bill discount</p>
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
              <span className={styles.muted}>Net payable</span>
              <span className={styles.drawerNetPayable}>
                ฿{formatBaht(draftNetPayable)}
              </span>
            </div>

            <p className={styles.drawerSectionLabel}>Customer pay</p>
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
              placeholder="Key amount paid"
              className={styles.customerPayInput}
            />

            {paymentMethod === 'Cash' && (
              <div className={styles.cashNoteRow} aria-label="Quick cash amount">
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
                    aria-label={`Add ${amount} Thai baht`}
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
              <span className={styles.muted}>Change</span>
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
                <button type="button" className={styles.drawerSecondaryBtn} onClick={clearDiscount}>Remove discount</button>
              )}
              <button type="button" className={styles.drawerPrimaryBtn} onClick={() => void submitInvoicePayment()} disabled={saleSubmitting}>
                {saleSubmitting ? 'Submitting...' : 'Submit'}
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
            <h2 className={styles.invoiceCreatedTitle}>Invoice created!</h2>
            <p className={styles.invoiceCreatedSub}>Payment received successfully</p>

            <div className={styles.invoiceCreatedDetails}>
              <div className={styles.invoiceCreatedRow}>
                <span>Invoice no.</span>
                <strong className={styles.invoiceCreatedNo}>{invoiceCreated.invoiceNo}</strong>
              </div>
              <div className={styles.invoiceCreatedRow}>
                <span>Amount paid</span>
                <strong>฿{formatBaht(invoiceCreated.amountPaid)}</strong>
              </div>
              <div className={styles.invoiceCreatedRow}>
                <span>Change</span>
                <strong>฿{formatBaht(invoiceCreated.changeDue)}</strong>
              </div>
              <div className={styles.invoiceCreatedRow}>
                <span>Method</span>
                <strong>{invoiceCreated.paymentMode}</strong>
              </div>
              <div className={styles.invoiceCreatedRow}>
                <span>Time</span>
                <strong className={styles.invoiceCreatedTime}>
                  {new Date(invoiceCreated.createdAt).toLocaleString('en-GB', {
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
              Print Receipt
            </button>
            <button ref={newSaleButtonRef} type="button" className={styles.newSaleBtn} onClick={resetForNewWalkIn}>
              <span className={styles.newSaleBtnIcon} aria-hidden="true">+</span>
              <span>New</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
