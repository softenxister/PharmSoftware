import type { StockItemInput } from "@server/db/types";
import type { StoredDosageForm } from "@/lib/productDosageForm";
import {
  PRODUCT_PACKAGE_VALUES,
  PRODUCT_SUBUNIT_VALUES,
  PRODUCT_UNIT_VALUES,
  canonicalizeProductUnit,
} from "@/i18n/productUnits";

export const PRODUCT_BARCODE_SLOT_LIMIT = 3;

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
  genericName: string;
  legalCategory: string;
  dosageForm: StoredDosageForm | "";
  packagingRows: ProductPackagingRow[];
};

export type ProductPersistenceIdentity = {
  productId?: string;
  lotNo: string;
  expiryDate: string;
};

export function getProductBarcodeSlots(value: string): string[] {
  return value.split(/[;,]/).map((barcode) => barcode.trim()).slice(0, PRODUCT_BARCODE_SLOT_LIMIT);
}

export function getProductBarcodeSlot(value: string, index: number): string {
  return getProductBarcodeSlots(value)[index] ?? "";
}

export function normalizeProductBarcodeValues(
  primaryValue: string | undefined,
  aliases: readonly string[] = [],
): string {
  return [primaryValue ?? "", ...aliases]
    .flatMap((value) => value.split(/[;,]/))
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, PRODUCT_BARCODE_SLOT_LIMIT)
    .join(", ");
}

export function setProductBarcodeSlot(value: string, index: number, nextValue: string): string {
  if (index < 0 || index >= PRODUCT_BARCODE_SLOT_LIMIT) return value;
  const slots = getProductBarcodeSlots(value);
  while (slots.length <= index) slots.push("");
  slots[index] = nextValue.replace(/[;,]/g, "").trim();
  while (slots.length > 1 && !slots[slots.length - 1]) slots.pop();
  return slots.join(", ");
}

type ProductSerializationOptions = {
  packagingChildUnit?: string;
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
    parentUnit: "",
    childQuantity: "",
    childUnit: "",
    barcode: "",
    sellPrice: "",
  };
}

export function createProductItemDraft(
  initialItem: Partial<StockItemInput> | undefined,
  defaultCategory: string,
  mode: "create" | "edit",
): ProductItemDraft {
  const isCreate = mode === "create";
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
    barcode: normalizeProductBarcodeValues(row.barcode, row.barcodes),
    sellPrice: row.sellPrice ?? "",
    id: `package-${index + 1}`,
  })) ?? [];

  return {
    photoUrl: initialItem?.photoUrl ?? "",
    barcode: normalizeProductBarcodeValues(initialItem?.barcode, initialItem?.barcodes),
    itemName: initialItem?.itemName ?? "",
    location: initialItem?.location ?? "",
    manufacturer: initialItem?.manufacturer ?? "",
    sellPrice: initialItem?.sellPrice ?? "",
    itemCategory: isCreate
      ? ""
      : initialItem?.itemCategory && initialItem.itemCategory !== "Unclassified"
        ? initialItem.itemCategory
        : "",
    weightage: initialItem?.weightage ?? "",
    subUnit: isCreate
      ? ""
      : normalizeProductUnit(
        initialItem?.subUnit,
        PRODUCT_SUBUNIT_VALUES,
        "",
      ),
    unit: isCreate
      ? ""
      : normalizeProductUnit(
        initialItem?.unit,
        PRODUCT_UNIT_VALUES,
        "",
      ),
    brandName: initialItem?.brandName ?? "",
    genericName: initialItem?.genericName ?? "",
    legalCategory: initialItem?.legalCategory ?? "",
    dosageForm: initialItem?.dosageForm && initialItem.dosageForm !== "Unclassified"
      ? initialItem.dosageForm
      : "",
    packagingRows: packagingRows.length > 0 ? packagingRows : [createPackagingRow()],
  };
}

export function getMissingProductFields(
  draft: ProductItemDraft,
  mode: "create" | "edit",
): string[] {
  const price = Number(draft.sellPrice);
  const missing: string[] = [];
  if (!draft.itemName.trim()) missing.push("item name");
  if (mode === "create" && !draft.brandName.trim()) missing.push("brand name");
  if (!Number.isFinite(price) || price <= 0) missing.push("sell price");
  if (!draft.weightage.trim()) missing.push("amount");
  if (mode === "create" && !draft.subUnit.trim()) missing.push("sub unit");
  if (mode === "create" && !draft.unit.trim()) missing.push("unit");
  if (mode === "create" && !getProductBarcodeSlots(draft.barcode).some(Boolean)) {
    missing.push("base unit barcode");
  }
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

export function serializeProductItemDraft(
  draft: ProductItemDraft,
  identity: ProductPersistenceIdentity,
  options: ProductSerializationOptions = {},
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
    itemCategory: draft.itemCategory.trim() || null,
    weightage: draft.weightage,
    subUnit: draft.subUnit,
    unit: draft.unit,
    brandName: draft.brandName,
    dosageForm: draft.dosageForm || null,
    packagingRows: draft.packagingRows.map((row) => ({
      ...row,
      childUnit: options.packagingChildUnit ?? row.childUnit,
    })),
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
