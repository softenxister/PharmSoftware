import { useState } from "react";
import type { StockItemInput } from "@server/db/types";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import {
  addPackagingRow,
  createProductItemDraft,
  generateProductBarcode,
  getMissingProductFields,
  removePackagingRow,
  setProductBarcodeSlot,
  serializeProductItemDraft,
  updatePackagingRow,
  type ProductItemDraft,
  type ProductPackagingRow,
} from "./productItemDraft";

type UseProductItemDraftInput = {
  defaultCategory: string;
  initialItem?: StockItemInput;
  mode: "create" | "edit";
  onSave?: (item: StockItemInput, photoFile?: File) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
};

export function useProductItemDraft({
  defaultCategory,
  initialItem,
  mode,
  onSave,
  onDelete,
}: UseProductItemDraftInput) {
  const { t } = usePreferences();
  const [draft, setDraft] = useState(() => (
    createProductItemDraft(initialItem, defaultCategory, mode)
  ));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [focusPackagingRowId, setFocusPackagingRowId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const isEditing = mode === "edit";
  const canSave = getMissingProductFields(draft, mode).length === 0;

  const updateField = <Key extends keyof ProductItemDraft>(
    key: Key,
    value: ProductItemDraft[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const patchPackagingRow = (id: string, patch: Partial<ProductPackagingRow>) => {
    setDraft((current) => updatePackagingRow(current, id, patch));
  };

  const appendPackagingRow = (focusNewRow = false) => {
    const id = crypto.randomUUID();
    setDraft((current) => addPackagingRow(current, id));
    if (focusNewRow) setFocusPackagingRowId(id);
  };

  const deletePackagingRow = (id: string) => {
    setDraft((current) => removePackagingRow(current, id));
  };

  const updateBarcodeSlot = (
    packagingRowId: string | undefined,
    barcodeIndex: number,
    value: string,
  ) => {
    setDraft((current) => {
      if (packagingRowId) {
        const row = current.packagingRows.find(({ id }) => id === packagingRowId);
        return row ? updatePackagingRow(current, packagingRowId, {
          barcode: setProductBarcodeSlot(row.barcode, barcodeIndex, value),
        }) : current;
      }
      return { ...current, barcode: setProductBarcodeSlot(current.barcode, barcodeIndex, value) };
    });
  };

  const appendGeneratedBarcode = (packagingRowId?: string, barcodeIndex = 0) => {
    const barcode = generateProductBarcode();
    updateBarcodeSlot(packagingRowId, barcodeIndex, barcode);
  };

  const save = async () => {
    if (!canSave || !onSave || saving) return;
    setSaveError("");
    setSaving(true);
    try {
      await onSave(serializeProductItemDraft(draft, {
        productId: initialItem?.productId,
        lotNo: initialItem?.lotNo ?? "",
        expiryDate: initialItem?.expiryDate ?? "",
      }, {
        packagingChildUnit: mode === "edit" ? draft.unit : undefined,
      }), photoFile ?? undefined);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("stockForm.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirmation = () => {
    setDeleteError("");
    setDeleteConfirmationOpen(true);
  };

  const closeDeleteConfirmation = () => {
    if (deleting) return;
    setDeleteConfirmationOpen(false);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!isEditing || !onDelete || deleting || saving) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      setDeleteError(t("stockForm.deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  return {
    draft,
    isEditing,
    saving,
    saveError,
    canSave,
    deleting,
    deleteError,
    deleteConfirmationOpen,
    focusPackagingRowId,
    photoFile,
    clearPackagingFocus: () => setFocusPackagingRowId(null),
    setPhotoFile,
    updateField,
    updateBarcodeSlot,
    patchPackagingRow,
    appendPackagingRow,
    deletePackagingRow,
    appendGeneratedBarcode,
    save,
    openDeleteConfirmation,
    closeDeleteConfirmation,
    confirmDelete,
  };
}

export type ProductItemDraftController = ReturnType<typeof useProductItemDraft>;
