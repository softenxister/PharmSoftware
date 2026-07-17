export type SalePricingLine = {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
};

export type BillDiscount = { type: "percent" | "thb"; value: number } | null;

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateSalePricing(lines: SalePricingLine[], billDiscount: BillDiscount) {
  const grossSubtotal = roundCurrency(lines.reduce((sum, line) => (
    sum + line.quantity * line.unitPrice
  ), 0));
  const itemDiscountAmount = roundCurrency(lines.reduce((sum, line) => {
    const percentage = Number.isInteger(line.discountPercent)
      ? Math.min(Math.max(line.discountPercent, 0), 100)
      : 0;
    return sum + (line.quantity * line.unitPrice * percentage) / 100;
  }, 0));
  const itemDiscountedSubtotal = Math.max(grossSubtotal - itemDiscountAmount, 0);
  const rawBillDiscount = !billDiscount
    ? 0
    : billDiscount.type === "percent"
      ? (itemDiscountedSubtotal * billDiscount.value) / 100
      : billDiscount.value;
  const billDiscountAmount = roundCurrency(Math.min(Math.max(rawBillDiscount, 0), itemDiscountedSubtotal));

  return {
    grossSubtotal,
    itemDiscountAmount,
    billDiscountAmount,
    netPayable: roundCurrency(itemDiscountedSubtotal - billDiscountAmount),
  };
}
