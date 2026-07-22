import type { ParentPack, ProductPack } from "@/server/db/types";

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

export type SellPackOption = {
  key: string;
  unit: string;
  label: string;
  relationLabel: string;
  displayLabel: string;
  priceMultiplier: number;
  sellPriceThb?: number;
  barcodes: string[];
};

export function displayPackUnit(unit: string): string {
  if (unit === "blisterpack") return "blister packs";
  return unit;
}

function sellPackButtonLabel(unit: string): string {
  if (unit === "blisterpack") return "blister";
  return unit;
}

function quantityKey(quantity: number): string {
  return Number.isFinite(quantity) ? String(quantity) : "0";
}

export function buildSellPackOptions(
  pack: ProductPack,
  parentPacks: readonly ParentPack[],
  baseBarcodes: readonly string[] = [],
): SellPackOption[] {
  return [
    {
      key: `base:${pack.packUnit}`,
      unit: pack.packUnit,
      label: sellPackButtonLabel(pack.packUnit),
      relationLabel: pack.label,
      displayLabel: `${pack.childQuantity} / ${displayPackUnit(pack.packUnit)}`,
      priceMultiplier: 1,
      barcodes: [...baseBarcodes],
    },
    ...parentPacks.map((parentPack) => {
      const quantity = quantityKey(parentPack.childPackQuantity);
      return {
        key: parentPack.id ?? `parent:${parentPack.packUnit}:${parentPack.childPackUnit}:${quantity}`,
        unit: parentPack.packUnit,
        label: `${sellPackButtonLabel(parentPack.packUnit)}(${quantity})`,
        relationLabel: parentPack.label,
        displayLabel: `${parentPack.childPackQuantity} / ${displayPackUnit(parentPack.packUnit)}`,
        priceMultiplier: parentPack.priceMultiplier,
        ...(parentPack.sellPriceThb === undefined ? {} : { sellPriceThb: parentPack.sellPriceThb }),
        barcodes: [...(parentPack.barcodes ?? [])],
      };
    }),
  ];
}

export type PaidSaleNextStep =
  | { kind: "invoice-preview" }
  | {
    kind: "receipt-route";
    path: string;
    resetOriginalSale: true;
    target: "new-tab";
  };

export function resolvePaidSaleNextStep(
  action: "submit" | "print",
  saleId: string,
): PaidSaleNextStep {
  if (action === "submit") return { kind: "invoice-preview" };
  return {
    kind: "receipt-route",
    path: `/sales/receipt/${encodeURIComponent(saleId)}`,
    resetOriginalSale: true,
    target: "new-tab",
  };
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
