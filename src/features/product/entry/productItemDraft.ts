import type { StockItemInput } from "@server/db/types";
import {
  PRODUCT_PACKAGE_VALUES,
  PRODUCT_SUBUNIT_VALUES,
  PRODUCT_UNIT_VALUES,
  canonicalizeProductUnit,
} from "@/i18n/productUnits";

export type ProductPackagingRow = {
  id: string;
  parentUnit: string;
  childQuantity: string;
  childUnit: string;
  barcode: string;
  sellPrice: string;
};

export type ProductItemDraft = {
  photoUrl: string;
  barcode: string;
  itemName: string;
  location: string;
  manufacturer: string;
  sellPrice: string;
  itemCategory: string;
  weightage: string;
  subUnit: string;
  unit: string;
  brandName: string;
  packagingRows: ProductPackagingRow[];
  regulatoryForms: string[];
};

export type ProductPersistenceIdentity = {
  productId?: string;
  lotNo: string;
  expiryDate: string;
};

type ProductSaveShortcutInput = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
};

export function isProductSaveShortcut(
  mode: "create" | "edit",
  input: ProductSaveShortcutInput,
): boolean {
  return mode === "edit"
    && (input.code === "KeyS" || input.key.toLowerCase() === "s")
    && (input.ctrlKey || input.metaKey)
    && !input.altKey
    && !input.shiftKey
    && !input.repeat;
}

export function selectProductIdentityText(
  mode: "create" | "edit",
  input: { select(): void },
): void {
  if (mode === "edit") input.select();
}

export function normalizeProductUnit(
  value: string | undefined,
  options: readonly string[],
  fallback: string,
): string {
  if (!value) return fallback;
  const canonical = canonicalizeProductUnit(value);
  if (options.includes(canonical)) return canonical;
  if (canonical === "ml" || canonical === "l") {
    return options.includes("bottle") ? "bottle" : fallback;
  }
  if (canonical === "g" || canonical === "kg") {
    return options.includes("pack") ? "pack" : fallback;
  }
  return canonical;
}

export function createPackagingRow(id: string = crypto.randomUUID()): ProductPackagingRow {
  return {
    id,
    parentUnit: "box",
    childQuantity: "",
    childUnit: "blisterpack",
    barcode: "",
    sellPrice: "",
  };
}

export function createProductItemDraft(
  initialItem: Partial<StockItemInput> | undefined,
  defaultCategory: string,
): ProductItemDraft {
  const packagingRows = initialItem?.packagingRows?.map((row, index) => ({
    ...row,
    parentUnit: normalizeProductUnit(
      row.parentUnit,
      PRODUCT_PACKAGE_VALUES,
      PRODUCT_PACKAGE_VALUES[0],
    ),
    childUnit: normalizeProductUnit(
      row.childUnit,
      PRODUCT_SUBUNIT_VALUES,
      PRODUCT_SUBUNIT_VALUES[0],
    ),
    barcode: [row.barcode, ...(row.barcodes ?? [])].filter(Boolean).join(", "),
    sellPrice: row.sellPrice ?? "",
    id: `package-${index + 1}`,
  })) ?? [];

  return {
    photoUrl: initialItem?.photoUrl ?? "",
    barcode: [initialItem?.barcode, ...(initialItem?.barcodes ?? [])].filter(Boolean).join(", "),
    itemName: initialItem?.itemName ?? "",
    location: initialItem?.location ?? "",
    manufacturer: initialItem?.manufacturer ?? "",
    sellPrice: initialItem?.sellPrice ?? "",
    itemCategory: defaultCategory,
    weightage: initialItem?.weightage ?? "",
    subUnit: normalizeProductUnit(
      initialItem?.subUnit,
      PRODUCT_SUBUNIT_VALUES,
      PRODUCT_SUBUNIT_VALUES[0],
    ),
    unit: normalizeProductUnit(
      initialItem?.unit,
      PRODUCT_UNIT_VALUES,
      PRODUCT_UNIT_VALUES[0],
    ),
    brandName: initialItem?.brandName ?? "",
    packagingRows: packagingRows.length > 0 ? packagingRows : [createPackagingRow()],
    regulatoryForms: ["ข.ย. 9"],
  };
}

export function getMissingProductFields(draft: ProductItemDraft): string[] {
  const price = Number(draft.sellPrice);
  const missing: string[] = [];
  if (!draft.barcode.trim()) missing.push("barcode");
  if (!draft.itemName.trim()) missing.push("item name");
  if (!Number.isFinite(price) || price <= 0) missing.push("sell price");
  if (!draft.weightage.trim()) missing.push("weightage");
  return missing;
}

export function updatePackagingRow(
  draft: ProductItemDraft,
  id: string,
  patch: Partial<ProductPackagingRow>,
): ProductItemDraft {
  return {
    ...draft,
    packagingRows: draft.packagingRows.map((row) => row.id === id ? { ...row, ...patch } : row),
  };
}

export function addPackagingRow(
  draft: ProductItemDraft,
  id: string = crypto.randomUUID(),
): ProductItemDraft {
  return { ...draft, packagingRows: [...draft.packagingRows, createPackagingRow(id)] };
}

export function removePackagingRow(draft: ProductItemDraft, id: string): ProductItemDraft {
  if (draft.packagingRows.length <= 1) return draft;
  return { ...draft, packagingRows: draft.packagingRows.filter((row) => row.id !== id) };
}

export function toggleRegulatoryForm(draft: ProductItemDraft, form: string): ProductItemDraft {
  if (form === "ข.ย. 9") return draft;
  const regulatoryForms = draft.regulatoryForms.includes(form)
    ? draft.regulatoryForms.filter((entry) => entry !== form)
    : [...draft.regulatoryForms, form];
  return { ...draft, regulatoryForms };
}

export function serializeProductItemDraft(
  draft: ProductItemDraft,
  identity: ProductPersistenceIdentity,
): StockItemInput {
  return {
    productId: identity.productId,
    photoUrl: draft.photoUrl,
    barcode: draft.barcode,
    itemName: draft.itemName,
    lotNo: identity.lotNo,
    expiryDate: identity.expiryDate,
    location: draft.location,
    manufacturer: draft.manufacturer,
    sellPrice: draft.sellPrice,
    itemCategory: draft.itemCategory,
    weightage: draft.weightage,
    subUnit: draft.subUnit,
    unit: draft.unit,
    brandName: draft.brandName,
    packagingRows: draft.packagingRows,
  };
}

export function generateProductBarcode(): string {
  const timePart = Date.now().toString().slice(-9);
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${timePart}${randomPart}`.slice(0, 13).padStart(13, "2");
}

export function decimalText(value: string): string {
  return value.replace(/[^\d.]/g, "");
}
