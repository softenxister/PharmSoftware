"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import styles from './NewSale.module.css';
import { salesProducts } from './salesData';

/* ════════════════════════════════════════════════════════════════════
   Types — swap for generated API types once the backend contracts land.
   ════════════════════════════════════════════════════════════════════ */

type PurchaseMethod = 'pickup' | 'delivery';
type DiscountType = 'percent' | 'thb';

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
  topItemIds?: string[]; // this customer's personal top-10 purchased items
}

interface Batch {
  batchId: string;
  batchNo: string;
  exp: string; // ISO date
  sellPrice: number;
  stock: number;
}

interface CatalogItem {
  id: string;
  code: string;
  barcode: string;
  category: string;
  name: string;
  brand: string;
  unit: string; // e.g. "Tab · 10/box"
  loc: string;
  image: string;
  batches: Batch[];
}

interface CartLine {
  lineId: string;
  itemId: string;
  itemName: string;
  unit: string;
  loc: string;
  batch: Batch;
  qty: number;
}

interface EditorState {
  item: CatalogItem;
  batch: Batch;
  qty: string;
  batchCardOpen: boolean;
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
  { id: 'c1', name: 'Suchada Wong', mobile: '081-234-5566', isMember: true, topItemIds: ['i1', 'i3', 'i5', 'i2', 'i7'] },
  { id: 'c2', name: 'Kridsada Phan', mobile: '089-771-2201', isMember: true, topItemIds: ['i4', 'i6', 'i1', 'i8', 'i2'] },
  { id: 'c3', name: 'Areeya Somboon', mobile: '086-005-9981', isMember: true, topItemIds: ['i2', 'i9', 'i10', 'i3'] },
  { id: 'c4', name: 'Natthapong Lee', mobile: '090-441-7723', isMember: true, topItemIds: ['i7', 'i1', 'i4'] },
];

const CATALOG: CatalogItem[] = [
  { id: 'i1', code: 'gy', barcode: '8850123001127', category: 'Pain relief', name: 'Paracetamol 500mg', brand: 'Tylenol', unit: 'Tab · 10/box', loc: 'A1-03', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&h=200&fit=crop',
    batches: [
      { batchId: 'b1', batchNo: 'PCM-2401', exp: '2026-11-30', sellPrice: 25, stock: 120 },
      { batchId: 'b2', batchNo: 'PCM-2405', exp: '2027-03-31', sellPrice: 25, stock: 300 },
    ] },
  { id: 'i2', code: 'g+99', barcode: '8850123004371', category: 'Allergy', name: 'Cetirizine 10mg', brand: 'Zyrtec', unit: 'Tab · 10/strip', loc: 'A2-11', image: 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=200&h=200&fit=crop',
    batches: [
      { batchId: 'b3', batchNo: 'CTZ-2402', exp: '2026-08-15', sellPrice: 45, stock: 40 },
      { batchId: 'b4', batchNo: 'CTZ-2406', exp: '2027-01-20', sellPrice: 45, stock: 150 },
    ] },
  { id: 'i3', code: 'gp3', barcode: '8850123009012', category: 'Digestive', name: 'Omeprazole 20mg', brand: 'Losec', unit: 'Cap · 14/strip', loc: 'B1-02', image: 'https://images.unsplash.com/photo-1550572017-9f8f4d1e1e5c?w=200&h=200&fit=crop',
    batches: [
      { batchId: 'b5', batchNo: 'OMZ-2312', exp: '2026-07-10', sellPrice: 89, stock: 18 },
      { batchId: 'b6', batchNo: 'OMZ-2404', exp: '2026-12-05', sellPrice: 89, stock: 60 },
    ] },
  { id: 'i4', code: 'gx7', barcode: '8850123002223', category: 'Antibiotic', name: 'Amoxicillin 500mg', brand: 'Amoxil', unit: 'Cap · 10/strip', loc: 'C1-05', image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=200&h=200&fit=crop',
    batches: [
      { batchId: 'b7', batchNo: 'AMX-2403', exp: '2026-09-28', sellPrice: 120, stock: 55 },
    ] },
  { id: 'i5', code: 'gv1', barcode: '8850123006543', category: 'Vitamin', name: 'Vitamin C 1000mg', brand: 'Blackmores', unit: 'Tab · 30/bottle', loc: 'D3-01', image: 'https://images.unsplash.com/photo-1616671276441-2f2d276abdc8?w=200&h=200&fit=crop',
    batches: [
      { batchId: 'b8', batchNo: 'VTC-2405', exp: '2027-06-30', sellPrice: 210, stock: 90 },
    ] },
  { id: 'i6', code: 'go2', barcode: '8850123007891', category: 'Digestive', name: 'ORS Rehydration Sachet', brand: 'Dhamra', unit: 'Sachet · 1/pc', loc: 'B2-08', image: 'https://images.unsplash.com/photo-1550572017-37b3f2c1b1a4?w=200&h=200&fit=crop',
    batches: [
      { batchId: 'b9', batchNo: 'ORS-2404', exp: '2026-10-18', sellPrice: 12, stock: 400 },
    ] },
  { id: 'i7', code: 'gi4', barcode: '8850123003340', category: 'Pain relief', name: 'Ibuprofen 400mg', brand: 'Brufen', unit: 'Tab · 10/strip', loc: 'A1-07', image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=200&h=200&fit=crop',
    batches: [
      { batchId: 'b10', batchNo: 'IBU-2401', exp: '2026-08-02', sellPrice: 38, stock: 25 },
      { batchId: 'b11', batchNo: 'IBU-2406', exp: '2027-02-14', sellPrice: 38, stock: 200 },
    ] },
  { id: 'i8', code: 'gl6', barcode: '8850123008765', category: 'Digestive', name: 'Loperamide 2mg', brand: 'Imodium', unit: 'Cap · 6/strip', loc: 'B1-09', image: 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=200&h=200&fit=crop',
    batches: [
      { batchId: 'b12', batchNo: 'LPM-2403', exp: '2026-11-11', sellPrice: 32, stock: 70 },
    ] },
  { id: 'i9', code: 'gd8', barcode: '8850123005432', category: 'Digestive', name: 'Domperidone 10mg', brand: 'Motilium', unit: 'Tab · 10/strip', loc: 'B1-04', image: 'https://images.unsplash.com/photo-1550572017-0c7a3b2c1f2b?w=200&h=200&fit=crop',
    batches: [
      { batchId: 'b13', batchNo: 'DMP-2402', exp: '2026-07-25', sellPrice: 54, stock: 15 },
    ] },
  { id: 'i10', code: 'gc9', barcode: '8850123009999', category: 'Cough & cold', name: 'Dextromethorphan Syrup', brand: 'Tuseran', unit: 'Bottle · 60ml', loc: 'C2-02', image: 'https://images.unsplash.com/photo-1587854692441-0c7a4c1cf1a1?w=200&h=200&fit=crop',
    batches: [
      { batchId: 'b14', batchNo: 'DXM-2404', exp: '2026-12-30', sellPrice: 68, stock: 45 },
    ] },
];

const THAI_CATALOG: CatalogItem[] = salesProducts.map((product) => ({
  id: product.id,
  code: product.shortCode,
  barcode: product.barcode,
  category: product.category,
  name: product.itemName,
  brand: product.brandName,
  unit: product.unit,
  loc: product.location,
  image: product.imageUrl,
  batches: product.batches.map((batch) => ({
    batchId: `${product.id}-${batch.batchNo}`,
    batchNo: batch.batchNo,
    exp: batch.expiryDate,
    sellPrice: batch.sellPriceThb,
    stock: batch.availableStock,
  })),
}));

// Store-wide best sellers this week — used when no member is attached to the sale.
const WEEKLY_TOP_ITEM_IDS = [...salesProducts]
  .sort((a, b) => b.weeklySold - a.weeklySold)
  .slice(0, 10)
  .map((product) => product.id);

/* ════════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════════ */

function formatBaht(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatExp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function nearestExpiryBatch(batches: Batch[]): Batch | null {
  const inStock = batches.filter((b) => b.stock > 0);
  if (inStock.length === 0) return null;
  return [...inStock].sort((a, b) => new Date(a.exp).getTime() - new Date(b.exp).getTime())[0];
}

/** Supports plain codes ("gy"), barcodes, and "c, <term>" category search. */
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
    item.code.toLowerCase().startsWith(q) ||
    item.name.toLowerCase().includes(q) ||
    item.brand.toLowerCase().includes(q)
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

/* ════════════════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════════════════ */

export default function NewSale(): React.ReactElement {
  const router = useRouter();

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
  const customerFieldRef = useClickOutside<HTMLDivElement>(() => setCustomerDropdownOpen(false));

  // Item search + editor row
  const [itemQuery, setItemQuery] = useState('');
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const itemFieldRef = useClickOutside<HTMLDivElement>(() => setItemDropdownOpen(false));
  const [editor, setEditor] = useState<EditorState | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  // Cart
  const [cartLines, setCartLines] = useState<CartLine[]>([]);

  // Top items rail
  const [heldItemId, setHeldItemId] = useState<string | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  // Discount drawer
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ type: DiscountType; value: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [billingDevice, setBillingDevice] = useState('Front Counter Thermal Printer');
  const [paperSize, setPaperSize] = useState('80mm thermal');
  const [autoPrint, setAutoPrint] = useState(true);

  /* ── Derived values ─────────────────────────────────────────────── */

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return CUSTOMERS;
    return CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q) || c.mobile.replace(/-/g, '').includes(q.replace(/-/g, '')));
  }, [customerQuery]);

  const itemMatches = useMemo(() => {
    const q = itemQuery.trim();
    if (!q) return [];
    return THAI_CATALOG.filter((it) => matchesQuery(it, q)).slice(0, 8);
  }, [itemQuery]);

  const totalQty = useMemo(() => cartLines.reduce((sum, l) => sum + l.qty, 0), [cartLines]);
  const uniqueItemCount = cartLines.length;
  const subtotal = useMemo(() => cartLines.reduce((sum, l) => sum + l.qty * l.batch.sellPrice, 0), [cartLines]);

  const discountAmount = useMemo(() => {
    if (!appliedDiscount) return 0;
    const raw = appliedDiscount.type === 'percent' ? (subtotal * appliedDiscount.value) / 100 : appliedDiscount.value;
    return Math.min(Math.max(raw, 0), subtotal);
  }, [appliedDiscount, subtotal]);

  const netPayable = Math.max(subtotal - discountAmount, 0);

  const topItemIds = useMemo(() => {
    if (customer && customer.isMember && customer.topItemIds?.length) return customer.topItemIds;
    return WEEKLY_TOP_ITEM_IDS;
  }, [customer]);

  const topItems = useMemo(() => {
    const mappedItems = topItemIds
      .map((id) => THAI_CATALOG.find((it) => it.id === id))
      .filter((it): it is CatalogItem => !!it)
      .slice(0, 10);

    return mappedItems.length > 0
      ? mappedItems
      : WEEKLY_TOP_ITEM_IDS
        .map((id) => THAI_CATALOG.find((it) => it.id === id))
        .filter((it): it is CatalogItem => !!it)
        .slice(0, 10);
  }, [topItemIds]);

  const topItemsLabel = customer && customer.isMember ? `Top picks for ${customer.name.split(' ')[0]}` : 'Top 10 Thai products this week';

  const recommendedBatchId = useMemo(
    () => (editor ? nearestExpiryBatch(editor.item.batches)?.batchId ?? null : null),
    [editor]
  );

  /* ── Handlers ───────────────────────────────────────────────────── */

  function openEditorForItem(item: CatalogItem) {
    const batch = nearestExpiryBatch(item.batches);
    if (!batch) return; // out of stock — nothing to sell
    setEditor({ item, batch, qty: '1', batchCardOpen: false });
    setItemQuery('');
    setItemDropdownOpen(false);
    window.setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  }

  function handleSelectBatch(batch: Batch) {
    if (!editor) return;
    setEditor({ ...editor, batch, batchCardOpen: false });
    window.setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  }

  function commitEditorToCart() {
    if (!editor) return;
    const qty = Math.max(1, parseInt(editor.qty, 10) || 1);
    setCartLines((prev) => [
      ...prev,
      {
        lineId: `${editor.item.id}-${editor.batch.batchId}-${Date.now()}`,
        itemId: editor.item.id,
        itemName: editor.item.name,
        unit: editor.item.unit,
        loc: editor.item.loc,
        batch: editor.batch,
        qty,
      },
    ]);
    setEditor(null);
  }

  function removeCartLine(lineId: string) {
    setCartLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  function updateCartQty(lineId: string, qty: number) {
    setCartLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, qty: Math.max(1, qty) } : l)));
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
    if (appliedDiscount) {
      setDiscountType(appliedDiscount.type);
      setDiscountInput(String(appliedDiscount.value));
    }
    setDiscountOpen(true);
  }

  function applyDiscount() {
    const value = parseFloat(discountInput);
    if (Number.isNaN(value) || value <= 0) {
      setAppliedDiscount(null);
    } else {
      setAppliedDiscount({ type: discountType, value });
    }
    setDiscountOpen(false);
  }

  function clearDiscount() {
    setAppliedDiscount(null);
    setDiscountInput('');
    setDiscountOpen(false);
  }

  function handleSave(mode: 'save' | 'save-print' | 'save-new') {
    const billDateTime = new Date();
    const savedBill = {
      id: `saved-${billDateTime.getTime()}`,
      billNo: `INV-${billDateTime
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, '')}-${String(billDateTime.getTime()).slice(-4)}`,
      date: billDateTime.toISOString(),
      customerName: customer?.name ?? 'Walk-in Customer',
      isMember: customer?.isMember ?? false,
      itemCount: cartLines.length,
      paymentMethod,
      purchaseMethod,
      netTotal: netPayable,
      status: 'paid',
    };

    const savedSales = window.localStorage.getItem(SAVED_SALES_KEY);
    let previousSales = [];
    try {
      previousSales = savedSales ? JSON.parse(savedSales) : [];
    } catch {
      previousSales = [];
    }
    window.localStorage.setItem(SAVED_SALES_KEY, JSON.stringify([savedBill, ...previousSales].slice(0, 30)));

    // TODO: wire to POST /api/sales — payload below is the shape the endpoint expects.
    const payload = {
      ownerId,
      paymentMethod,
      purchaseMethod,
      billDate,
      pharmacistId,
      customerId: customer?.id ?? null,
      lines: cartLines,
      subtotal,
      discount: appliedDiscount,
      netPayable,
      billingDevice,
      paperSize,
      autoPrint,
      mode,
    };
    console.log('Saving sale', payload);
    setSaveMenuOpen(false);
    if (mode === 'save-new') {
      setCartLines([]);
      setEditor(null);
      setAppliedDiscount(null);
      setDiscountInput('');
      return;
    }
    router.push('/sales');
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
          <label className={styles.selectField}>
            <select aria-label="Owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={styles.select}>
              {OWNERS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>

          <label className={styles.selectField}>
            <select aria-label="Payment method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={styles.select}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>

          <label className={styles.selectField}>
            <select aria-label="Fulfilment" value={purchaseMethod} onChange={(e) => setPurchaseMethod(e.target.value as PurchaseMethod)} className={styles.select}>
              <option value="pickup">Pickup</option>
              <option value="delivery">Delivery</option>
            </select>
          </label>

          <div className={styles.saveSplit} ref={saveMenuRef}>
            <button type="button" className={styles.saveMain} onClick={() => handleSave('save')}>
              Save
            </button>
            <button
              type="button"
              className={styles.saveChevron}
              onClick={() => setSaveMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={saveMenuOpen}
              aria-label="More save options"
            >
              <IconChevronDown />
            </button>
            {saveMenuOpen && (
              <div className={styles.saveMenu} role="menu">
                <button type="button" role="menuitem" className={styles.saveMenuItem} onClick={() => handleSave('save-print')}>Save &amp; print</button>
                <button type="button" role="menuitem" className={styles.saveMenuItem} onClick={() => handleSave('save-new')}>Save &amp; start new sale</button>
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
        <label className={styles.metaField}>
          <span className={styles.metaLabel}>Bill date</span>
          <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={styles.dateInput} />
        </label>

        <div className={styles.metaField} ref={customerFieldRef} style={{ position: 'relative' }}>
          <span className={styles.metaLabel}>Customer</span>
          {customer ? (
            <div className={styles.customerChip}>
              <span className={styles.avatar}>{initials(customer.name)}</span>
              <div className={styles.customerChipMeta}>
                <span className={styles.customerChipName}>{customer.name}</span>
                <span className={styles.customerChipMobile}>{customer.mobile}{customer.isMember ? ' · Member' : ''}</span>
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
                onFocus={() => setCustomerDropdownOpen(true)}
                placeholder="Search name or mobile number"
                className={styles.textInput}
              />
              {customerDropdownOpen && (
                <div className={styles.dropdownPanel}>
                  {customerMatches.length === 0 && (
                    <div className={styles.dropdownEmpty}>No customer found — sale will be walk-in.</div>
                  )}
                  {customerMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={styles.customerOption}
                      onClick={() => { setCustomer(c); setCustomerDropdownOpen(false); }}
                    >
                      <span className={styles.avatar}>{initials(c.name)}</span>
                      <div className={styles.customerChipMeta}>
                        <span className={styles.customerChipName}>{c.name}</span>
                        <span className={styles.customerChipMobile}>{c.mobile}{c.isMember ? ' · Member' : ''}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <label className={styles.metaField}>
          <span className={styles.metaLabel}>Pharmacist</span>
          <select value={pharmacistId} onChange={(e) => setPharmacistId(e.target.value)} className={styles.select}>
            {PHARMACISTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      {/* Scrollable body */}
      <div className={styles.scrollArea}>
        {/* Item search */}
        <div className={styles.searchSection} ref={itemFieldRef}>
          <div className={styles.itemSearchField}>
            <IconSearch className={styles.itemSearchIcon} />
            <input
              type="text"
              value={itemQuery}
              onChange={(e) => { setItemQuery(e.target.value); setItemDropdownOpen(true); }}
              onFocus={() => setItemDropdownOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && itemMatches[0]) {
                  e.preventDefault();
                  openEditorForItem(itemMatches[0]);
                }
              }}
              placeholder="Search item — code, barcode, or c, category"
              className={styles.itemSearchInput}
            />
          </div>
          {itemDropdownOpen && itemQuery.trim() && (
            <div className={styles.itemDropdownPanel}>
              {itemMatches.length === 0 && <div className={styles.dropdownEmpty}>No matching item.</div>}
              {itemMatches.map((it) => {
                const nearest = nearestExpiryBatch(it.batches);
                return (
                  <button key={it.id} type="button" className={styles.itemOption} onClick={() => openEditorForItem(it)}>
                    <img src={it.image} alt="" className={styles.itemOptionThumb} />
                    <div className={styles.itemOptionMeta}>
                      <span className={styles.itemOptionName}>{it.name}</span>
                      <span className={styles.itemOptionSub}>{it.brand} · {it.unit} · {it.loc}</span>
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
          <div className={styles.editorBlock}>
            <div className={styles.editorRow}>
              <button type="button" className={styles.binButton} onClick={() => setEditor(null)} aria-label="Cancel adding item">
                <IconBin />
              </button>
              <span className={styles.itemNameCell}>{editor.item.name}</span>
              <span className={styles.muted}>{editor.item.unit}</span>
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
              <span className={styles.alignRight}>฿{formatBaht(editor.batch.sellPrice)}</span>
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
                  const clampedQty = digitsOnly
                    ? String(Math.min(editor.batch.stock, Math.max(1, parseInt(digitsOnly, 10))))
                    : '';
                  setEditor({ ...editor, qty: clampedQty });
                }}
                className={styles.qtyInputSmall}
              />
            </div>

            {editor.batchCardOpen && (
              <div className={styles.batchCard}>
                <p className={styles.batchCardLabel}>Choose a batch — nearest expiry is pre-selected</p>
                <div className={styles.batchOptions}>
                  {editor.item.batches.filter((b) => b.stock > 0).map((b) => (
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
                      <span className={styles.batchOptionRow}><span className={styles.muted}>Sell</span> ฿{formatBaht(b.sellPrice)}</span>
                      <span className={styles.batchOptionRow}><span className={styles.muted}>Stock</span> {b.stock}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.editorFooter}>
              <button type="button" className={styles.addButton} onClick={commitEditorToCart}>
                Add to sale
              </button>
            </div>
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
                  <th>Unit / pack</th>
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
                    <td className={styles.muted}>{line.unit}</td>
                    <td className={styles.muted}>{line.loc}</td>
                    <td className={styles.muted}>{line.batch.batchNo}</td>
                    <td className={styles.muted}>{formatExp(line.batch.exp)}</td>
                    <td className={styles.alignRight}>฿{formatBaht(line.batch.sellPrice)}</td>
                    <td className={styles.alignRight}>
                      <input
                        type="number"
                        min={1}
                        value={line.qty}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => updateCartQty(line.lineId, parseInt(e.target.value, 10) || 1)}
                        className={styles.qtyInputSmall}
                      />
                    </td>
                    <td className={styles.alignRight}>
                      <span className={styles.lineTotal}>฿{formatBaht(line.qty * line.batch.sellPrice)}</span>
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
            <p className={styles.topItemsLabel}>{topItemsLabel}</p>
            <div className={styles.topItemsRail}>
              {topItems.map((it) => {
                const isHeld = heldItemId === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`${styles.topItemCard} ${isHeld ? styles.topItemCardHeld : ''}`}
                    onMouseDown={() => startHold(it.id)}
                    onMouseUp={endHold}
                    onMouseLeave={endHold}
                    onTouchStart={() => startHold(it.id)}
                    onTouchEnd={endHold}
                    onClick={() => !isHeld && handleTopItemTap(it)}
                  >
                    <img src={it.image} alt="" className={styles.topItemImage} />
                    {isHeld ? (
                      <div className={styles.topItemHeldInfo}>
                        <span className={styles.topItemHeldName}>{it.name}</span>
                        <span className={styles.topItemHeldSub}>{it.brand} | {it.unit} | {it.loc}</span>
                      </div>
                    ) : (
                      <span className={styles.topItemName}>{it.name}</span>
                    )}
                  </button>
                );
              })}
            </div>
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
        <button type="button" className={styles.netPayableCell} onClick={openDiscountDrawer}>
          <span className={styles.summaryStatLabel}>
            Net payable {appliedDiscount && <span className={styles.discountBadge}>discount applied</span>}
          </span>
          <span className={styles.netPayableValue}>฿{formatBaht(netPayable)}</span>
        </button>
      </div>

      {/* Sale settings */}
      {settingsOpen && (
        <div className={styles.drawerBackdrop} onClick={() => setSettingsOpen(false)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>Sale settings</h2>
              <button type="button" className={styles.drawerClose} onClick={() => setSettingsOpen(false)} aria-label="Close">
                <IconClose />
              </button>
            </div>

            <p className={styles.drawerSectionLabel}>Billing device</p>
            <label className={styles.settingsField}>
              <span className={styles.settingsLabel}>Receipt printer</span>
              <select value={billingDevice} onChange={(e) => setBillingDevice(e.target.value)} className={styles.settingsSelect}>
                <option>Front Counter Thermal Printer</option>
                <option>Back Counter Thermal Printer</option>
                <option>PDF Preview Only</option>
                <option>USB Receipt Printer</option>
              </select>
            </label>

            <label className={styles.settingsField}>
              <span className={styles.settingsLabel}>Paper size</span>
              <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)} className={styles.settingsSelect}>
                <option>80mm thermal</option>
                <option>58mm thermal</option>
                <option>A5 invoice</option>
                <option>A4 invoice</option>
              </select>
            </label>

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

            <div className={styles.devicePreview}>
              <span className={styles.muted}>Current setup</span>
              <strong>{billingDevice}</strong>
              <span>{paperSize} {autoPrint ? '| auto print on' : '| auto print off'}</span>
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

            <p className={styles.drawerSectionLabel}>Bill discount — for a loyal customer, or a one-off price break</p>
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
                ฿{formatBaht(
                  discountInput
                    ? Math.max(subtotal - (discountType === 'percent' ? (subtotal * (parseFloat(discountInput) || 0)) / 100 : parseFloat(discountInput) || 0), 0)
                    : subtotal
                )}
              </span>
            </div>

            <div className={styles.drawerActions}>
              {appliedDiscount && (
                <button type="button" className={styles.drawerSecondaryBtn} onClick={clearDiscount}>Remove discount</button>
              )}
              <button type="button" className={styles.drawerPrimaryBtn} onClick={applyDiscount}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
