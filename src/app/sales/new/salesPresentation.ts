type ProductDescriptionInput = {
  brand: string;
  packLabel: string;
  location: string;
  totalStock: number;
  showLocation: boolean;
  showStock: boolean;
};

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
