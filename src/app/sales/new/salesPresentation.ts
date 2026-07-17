type ProductDescriptionInput = {
  brand: string;
  packLabel: string;
  location: string;
  totalStock: number;
  showLocation: boolean;
  showStock: boolean;
};

export { calculateSalePricing } from "@/lib/salePricing";

const formatStock = (value: number) => Number.isFinite(value)
  ? value.toLocaleString("en-US", { maximumFractionDigits: 3 })
  : "0";

export function buildProductDescription(input: ProductDescriptionInput): string {
  const parts = [input.brand, input.packLabel];
  if (input.showLocation && input.location.trim()) parts.push(input.location.trim());
  if (input.showStock) parts.push(`${formatStock(input.totalStock)} stock`);
  return parts.filter(Boolean).join(" - ");
}

export function shouldUseSellPackDropdown(sellPackCount: number): boolean {
  return Number.isFinite(sellPackCount) && sellPackCount > 1;
}

export type DefaultReminderState = {
  enabled: boolean;
  activeTime: number;
  doses: [number, number, number, number];
};

export function createReminderFromDefaultDosage(
  dosage: readonly number[] | undefined,
): DefaultReminderState {
  const doses = dosage?.length === 4 && dosage.every((dose) => Number.isInteger(dose) && dose >= 0 && dose <= 99)
    ? [...dosage] as [number, number, number, number]
    : [0, 0, 0, 0] as [number, number, number, number];
  return { enabled: doses.some((dose) => dose > 0), activeTime: 0, doses };
}
