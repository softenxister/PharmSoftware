export type ReceiptPaperSize = "58" | "80";

export type ReceiptStoreSnapshot = {
  storeName: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  lineId: string;
  facebookPage: string;
  openingTime: string;
  closingTime: string;
};

export type ReceiptLineSnapshot = {
  position: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ReceiptSnapshot = {
  version: 1;
  saleId: string;
  billNo: string;
  soldAt: string;
  customerName: string;
  salespersonName: string;
  paymentMethod: string;
  store: ReceiptStoreSnapshot;
  lines: ReceiptLineSnapshot[];
  itemSubtotal: number;
  billDiscountAmount: number;
  netTotal: number;
  customerPaid: number;
  changeDue: number;
  vat: { beforeVat: number; vatAmount: number };
};

export type ReceiptSnapshotInput = Omit<ReceiptSnapshot, "version" | "customerName" | "lines" | "itemSubtotal" | "netTotal" | "vat"> & {
  customerName: string;
  expectedNetTotal?: number;
  lines: Array<{
    position: number;
    itemName: string;
    quantity: number;
    originalUnitPrice: number;
    discountPercent: number;
  }>;
};

export type LegacyReceiptSnapshotInput = Omit<ReceiptSnapshotInput, "lines" | "billDiscountAmount"> & {
  netTotal: number;
  billDiscount: { type: "percent" | "thb"; value: number } | null;
  lines: Array<{
    position: number;
    itemName: string;
    quantity: number;
    originalUnitPrice: number;
  }>;
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const receiptCustomerName = (value: string) => value.trim() && value !== "Walk-in Customer"
  ? value.trim()
  : "ลูกค้าทั่วไป";

export function calculateInclusiveVat(netTotal: number) {
  const safeNet = Number.isFinite(netTotal) ? Math.max(roundCurrency(netTotal), 0) : 0;
  const vatAmount = roundCurrency((safeNet * 7) / 107);
  return { beforeVat: roundCurrency(safeNet - vatAmount), vatAmount };
}

export function normalizeReceiptPaperSize(value: unknown): ReceiptPaperSize {
  return value === "58" ? "58" : "80";
}

export function receiptPaymentMethodLabel(value: string): string {
  if (value === "Cash") return "เงินสด";
  if (value === "Bank transfer") return "โอนเงิน";
  if (value === "Credit card") return "บัตรเครดิต";
  return value.trim() || "ไม่ระบุ";
}

export function isReceiptStoreReady(store: unknown): store is ReceiptStoreSnapshot {
  if (!store || typeof store !== "object") return false;
  const candidate = store as Partial<ReceiptStoreSnapshot>;
  const values = [candidate.storeName, candidate.address, candidate.phone, candidate.email, candidate.taxId,
    candidate.lineId, candidate.facebookPage, candidate.openingTime, candidate.closingTime];
  if (values.some((value) => typeof value !== "string")) return false;
  return Boolean(
    candidate.storeName?.trim()
    && candidate.address?.trim()
    && candidate.phone?.trim()
    && candidate.taxId?.trim()
    && TIME_PATTERN.test(candidate.openingTime ?? "")
    && TIME_PATTERN.test(candidate.closingTime ?? ""),
  );
}

export function createReceiptSnapshot(input: ReceiptSnapshotInput): ReceiptSnapshot {
  if (!isReceiptStoreReady(input.store)) {
    throw new Error("Store Profile must include store name, address, phone, Tax ID, and operating hours.");
  }
  const saleId = input.saleId.trim();
  const billNo = input.billNo.trim();
  const salespersonName = input.salespersonName.trim();
  const customerName = receiptCustomerName(input.customerName);
  const paymentMethod = input.paymentMethod.trim();
  const soldAt = new Date(input.soldAt);
  if (!saleId || saleId.length > 200 || !billNo || billNo.length > 100 || !salespersonName
    || salespersonName.length > 200 || customerName.length > 200 || !paymentMethod || paymentMethod.length > 100
    || input.lines.length === 0 || Number.isNaN(soldAt.getTime())) {
    throw new Error("Receipt identity is incomplete.");
  }
  if (!/^[\x20-\x7e]+$/.test(billNo)) throw new Error("Receipt bill number must use printable ASCII characters.");
  if (input.lines.length > 500) throw new Error("Receipt has too many item lines.");

  const lines = input.lines.map((line, index): ReceiptLineSnapshot => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("Receipt items require positive whole-number quantities.");
    }
    if (!line.itemName.trim() || line.itemName.trim().length > 500
      || !Number.isFinite(line.originalUnitPrice) || line.originalUnitPrice < 0) {
      throw new Error("Receipt item details are invalid.");
    }
    const discountPercent = Number.isInteger(line.discountPercent)
      ? Math.min(Math.max(line.discountPercent, 0), 100)
      : 0;
    const unitPrice = roundCurrency(line.originalUnitPrice * (1 - discountPercent / 100));
    return {
      position: Number.isInteger(line.position) && line.position >= 0 ? line.position : index,
      itemName: line.itemName.trim(),
      quantity: line.quantity,
      unitPrice,
      lineTotal: roundCurrency(unitPrice * line.quantity),
    };
  }).sort((first, second) => first.position - second.position);

  let itemSubtotal = roundCurrency(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const billDiscountAmount = Math.min(Math.max(roundCurrency(input.billDiscountAmount), 0), itemSubtotal);
  let netTotal = roundCurrency(itemSubtotal - billDiscountAmount);
  if (input.expectedNetTotal !== undefined) {
    if (!Number.isFinite(input.expectedNetTotal) || input.expectedNetTotal < 0) {
      throw new Error("Receipt net total is invalid.");
    }
    const expectedNetTotal = roundCurrency(input.expectedNetTotal);
    const expectedSubtotal = roundCurrency(expectedNetTotal + billDiscountAmount);
    const roundingAdjustment = roundCurrency(expectedSubtotal - itemSubtotal);
    const finalLine = lines.at(-1);
    if (!finalLine || Math.abs(roundingAdjustment) > 5 || finalLine.lineTotal + roundingAdjustment < 0) {
      throw new Error("Receipt pricing does not match the paid sale.");
    }
    finalLine.lineTotal = roundCurrency(finalLine.lineTotal + roundingAdjustment);
    itemSubtotal = expectedSubtotal;
    netTotal = expectedNetTotal;
  }
  if (!Number.isFinite(input.customerPaid) || input.customerPaid < netTotal) {
    throw new Error("Receipt payment does not cover the net total.");
  }

  return {
    version: 1,
    saleId,
    billNo,
    soldAt: soldAt.toISOString(),
    customerName,
    salespersonName,
    paymentMethod,
    store: { ...input.store },
    lines,
    itemSubtotal,
    billDiscountAmount,
    netTotal,
    customerPaid: roundCurrency(input.customerPaid),
    changeDue: Math.max(roundCurrency(input.changeDue), 0),
    vat: calculateInclusiveVat(netTotal),
  };
}

export function createLegacyReceiptSnapshot(input: LegacyReceiptSnapshotInput): ReceiptSnapshot {
  if (!isReceiptStoreReady(input.store)) {
    throw new Error("Store Profile must include store name, address, phone, Tax ID, and operating hours.");
  }
  if (!Number.isFinite(input.netTotal) || input.netTotal <= 0 || input.lines.length === 0) {
    throw new Error("Legacy receipt totals are invalid.");
  }
  const netTotal = roundCurrency(input.netTotal);
  const billDiscountAmount = !input.billDiscount
    ? 0
    : input.billDiscount.type === "thb"
      ? Math.max(roundCurrency(input.billDiscount.value), 0)
      : input.billDiscount.value >= 100
        ? 0
        : roundCurrency((netTotal * Math.max(input.billDiscount.value, 0)) / (100 - input.billDiscount.value));
  const itemSubtotal = roundCurrency(netTotal + billDiscountAmount);
  const grossWeights = input.lines.map((line) => line.quantity * line.originalUnitPrice);
  const grossTotal = grossWeights.reduce((sum, value) => sum + value, 0);
  if (grossTotal <= 0) throw new Error("Legacy receipt item totals are invalid.");

  let allocated = 0;
  const lines = input.lines.map((line, index): ReceiptLineSnapshot => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0 || !line.itemName.trim()) {
      throw new Error("Legacy receipt items require positive whole-number quantities.");
    }
    const lineTotal = index === input.lines.length - 1
      ? roundCurrency(itemSubtotal - allocated)
      : roundCurrency(itemSubtotal * (grossWeights[index] / grossTotal));
    allocated = roundCurrency(allocated + lineTotal);
    return {
      position: line.position,
      itemName: line.itemName.trim(),
      quantity: line.quantity,
      unitPrice: roundCurrency(lineTotal / line.quantity),
      lineTotal,
    };
  }).sort((first, second) => first.position - second.position);

  return {
    version: 1,
    saleId: input.saleId.trim(),
    billNo: input.billNo.trim(),
    soldAt: new Date(input.soldAt).toISOString(),
    customerName: receiptCustomerName(input.customerName),
    salespersonName: input.salespersonName.trim() || "ไม่ระบุ",
    paymentMethod: input.paymentMethod.trim(),
    store: { ...input.store },
    lines,
    itemSubtotal,
    billDiscountAmount,
    netTotal,
    customerPaid: roundCurrency(Math.max(input.customerPaid, netTotal)),
    changeDue: Math.max(roundCurrency(input.changeDue), 0),
    vat: calculateInclusiveVat(netTotal),
  };
}

export function parseReceiptSnapshot(value: unknown): ReceiptSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReceiptSnapshot>;
  const stringFields = [candidate.saleId, candidate.billNo, candidate.soldAt, candidate.customerName,
    candidate.salespersonName, candidate.paymentMethod];
  const numberFields = [candidate.itemSubtotal, candidate.billDiscountAmount, candidate.netTotal,
    candidate.customerPaid, candidate.changeDue, candidate.vat?.beforeVat, candidate.vat?.vatAmount];
  if (candidate.version !== 1 || stringFields.some((field) => typeof field !== "string" || !field.trim())) return null;
  if (candidate.saleId!.length > 200 || candidate.billNo!.length > 100 || candidate.customerName!.length > 200
    || candidate.salespersonName!.length > 200 || candidate.paymentMethod!.length > 100
    || !/^[\x20-\x7e]+$/.test(candidate.billNo!)
    || Number.isNaN(new Date(candidate.soldAt!).getTime())) return null;
  if (numberFields.some((field) => typeof field !== "number" || !Number.isFinite(field) || field < 0)) return null;
  if (!candidate.store || !isReceiptStoreReady(candidate.store)) return null;
  if (!Array.isArray(candidate.lines) || candidate.lines.length === 0 || candidate.lines.length > 500) return null;
  const validLines = candidate.lines.every((line) => (
    Boolean(line) && typeof line === "object"
    && Number.isInteger(line.position) && line.position >= 0
    && typeof line.itemName === "string" && Boolean(line.itemName.trim()) && line.itemName.length <= 500
    && Number.isInteger(line.quantity) && line.quantity > 0
    && Number.isFinite(line.unitPrice) && line.unitPrice >= 0
    && Number.isFinite(line.lineTotal) && line.lineTotal >= 0
  ));
  if (!validLines) return null;
  const lineSubtotal = roundCurrency(candidate.lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const totalsMatch = lineSubtotal === roundCurrency(candidate.itemSubtotal!)
    && roundCurrency(candidate.itemSubtotal! - candidate.billDiscountAmount!) === roundCurrency(candidate.netTotal!)
    && roundCurrency(candidate.vat!.beforeVat + candidate.vat!.vatAmount) === roundCurrency(candidate.netTotal!)
    && candidate.customerPaid! >= candidate.netTotal!;
  return totalsMatch ? candidate as ReceiptSnapshot : null;
}
