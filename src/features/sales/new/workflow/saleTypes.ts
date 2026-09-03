import type { SellPackOption } from './saleDraft';
import type { StorePaymentMethod } from '@/config/preferences/storePosSettings';

export type PurchaseMethod = 'pickup' | 'delivery';
export type DiscountType = 'percent' | 'thb';
export type AppliedDiscount = { type: DiscountType; value: number };
export type SaveMode = 'save' | 'save-print' | 'save-new';
export type BillStatus = 'paid' | 'pending';
export type ReminderDoses = [number, number, number, number];
export type ReminderState = {
  enabled: boolean;
  activeTime: number;
  doses: ReminderDoses;
};

export interface Owner {
  id: string;
  name: string;
}

export interface Pharmacist {
  id: string;
  name: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  avatarUrl?: string | null;
  isMember: boolean;
  points: number;
  membershipRank: string;
  topItemIds?: string[];
  allergies: Array<{
    id: string;
    canonicalName: string;
    thaiName?: string;
  }>;
}

export interface Batch {
  batchId: string;
  batchNo: string;
  exp: string;
  sellPrice: number;
  stock: number;
}

export type SellPack = SellPackOption;

export interface CatalogItem {
  id: string;
  barcode: string;
  barcodes: string[];
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
  discountPercent: number;
  isDiscountLocked: boolean;
  defaultDosage: ReminderDoses;
  activeIngredients: Array<{
    id: string;
    canonicalName: string;
    thaiName?: string;
  }>;
  batches: Batch[];
}

export interface CartLine {
  lineId: string;
  itemId: string;
  itemName: string;
  packLabel: string;
  packMultiplier: number;
  unitPrice: number;
  loc: string;
  batch: Batch;
  qty: number;
}

export interface EditorState {
  item: CatalogItem;
  batch: Batch;
  sellPack: SellPack;
  qty: string;
  batchCardOpen: boolean;
}

export type SelectOption = {
  value: string;
  label: string;
  shortcut?: string;
};

export type InvoiceCreated = {
  saleId: string;
  invoiceNo: string;
  amountPaid: number;
  netTotal: number;
  changeDue: number;
  paymentMode: string;
  createdAt: string;
};

export type PendingConfirmation = { kind: 'remove-item'; cartKey: string; itemName: string };

export type SalesApiResponse = {
  sale?: {
    id: string;
    billNo: string;
    date: string;
    status: BillStatus;
  };
  error?: string;
  code?: string;
};

export type SavedSale = {
  id: string;
  billNo: string;
  date: string;
  customerName: string;
  customerMobile: string;
  isMember: boolean;
  itemCount: number;
  paymentMethod: string;
  purchaseMethod: string;
  netTotal: number;
  status: BillStatus | 'void';
  ownerId: string | null;
  billDate: string;
  pharmacistId: string | null;
  customerId: string | null;
  lines: CartLine[];
  discount: AppliedDiscount | null;
};

export type SaleWriteRequest = {
  status: BillStatus;
  id?: string;
  billNo?: string;
  owner: { id: string; name: string };
  pharmacist: { id: string; name: string };
  customer: Customer | null;
  paymentMethod: StorePaymentMethod;
  purchaseMethod: PurchaseMethod;
  billDate: string;
  subtotal: number;
  netPayable: number;
  customerPaid: number | null;
  changeDue: number;
  discount: AppliedDiscount | null;
  lines: CartLine[];
};

export const OWNERS: Owner[] = [
  { id: 'o1', name: 'Sukhumvit Branch — K. Anong' },
  { id: 'o2', name: 'Thonglor Branch — K. Preecha' },
  { id: 'o3', name: 'Head Office Account' },
];

export const PHARMACISTS: Pharmacist[] = [
  { id: 'p1', name: 'Ph. Nattaya S.' },
  { id: 'p2', name: 'Ph. Somchai T.' },
  { id: 'p3', name: 'Ph. Kanokwan R.' },
];
