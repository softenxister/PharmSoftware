import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Camera, ImagePlus, Wand2 } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import {
  PRODUCT_PHOTO_FILE_TYPES,
  validateProductPhotoFile,
} from "@/api/stockCatalogClient";
import type { ProductItemDraftController } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

export function ProductPhotoField({
  controller,
  onSelectIdentity,
  onFlowEnter,
  variant = "default",
}: {
  controller: ProductItemDraftController;
  onSelectIdentity: (input: HTMLInputElement) => void;
  onFlowEnter: (event: KeyboardEvent<HTMLElement>) => void;
  variant?: "default" | "edit";
}) {
  const { t } = usePreferences();
  const { draft } = controller;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (!controller.photoFile) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(controller.photoFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [controller.photoFile]);

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (validateProductPhotoFile(file)) {
      setPhotoError(t("stockForm.photoFileError"));
      input.value = "";
      return;
    }
    setPhotoError("");
    controller.setPhotoFile(file);
    input.value = "";
  };

  const preview = (
    <>
      {(previewUrl || draft.photoUrl.trim()) ? (
        <img src={previewUrl || draft.photoUrl} alt={t("stockForm.preview")} />
      ) : (
        <span><ImagePlus size={30} aria-hidden="true" /></span>
      )}
      {controller.isEditing && (
        <small className={styles.photoUploadHint}>
          <Camera size={14} aria-hidden="true" />
          {controller.photoFile
            ? t("stockForm.photoSelected")
            : t("stockForm.choosePhoto")}
        </small>
      )}
    </>
  );

  const photoUrlField = (
    <label className={`${styles.field} ${variant === "edit" ? styles.editPhotoFieldGroup : ""}`}>
      <span>{variant === "edit" ? t("stockForm.photoUrl") : t("stockForm.photo")}</span>
      <input
        type="text"
        value={draft.photoUrl}
        placeholder="https://example.com/photo.jpg"
        onClick={(event) => onSelectIdentity(event.currentTarget)}
        onChange={(event) => {
          controller.setPhotoFile(null);
          setPhotoError("");
          controller.updateField("photoUrl", event.target.value);
        }}
      />
    </label>
  );

  const barcodeField = (
    <label
      className={`${styles.field} ${variant === "edit" ? styles.editPhotoFieldGroup : ""}`}
      data-stock-flow="barcode"
      onKeyDown={onFlowEnter}
    >
      <span>{variant === "edit" ? t("stockForm.barcode") : t("stockForm.barcodes")}</span>
      <span className={styles.inlineField}>
        <input
          type="text"
          value={draft.barcode}
          onClick={(event) => onSelectIdentity(event.currentTarget)}
          onChange={(event) => controller.updateField("barcode", event.target.value)}
          placeholder={t("stockForm.barcodesPlaceholder")}
        />
        <button
          type="button"
          onClick={() => controller.appendGeneratedBarcode()}
          title={t("stockForm.generateBarcode")}
        >
          <Wand2 size={15} aria-hidden="true" />
        </button>
      </span>
    </label>
  );

  return (
    <section
      className={`${styles.photoPanel} ${variant === "edit" ? styles.editPhotoPanel : ""}`}
      aria-label={t("stockForm.productPhoto")}
    >
      {controller.isEditing ? (
        <button
          type="button"
          className={`${styles.photoPreview} ${styles.photoPreviewButton} ${
            variant === "edit" ? styles.editPhotoPreview : ""
          }`}
          onClick={() => fileInputRef.current?.click()}
          disabled={controller.saving || controller.deleting}
          aria-label={t("stockForm.choosePhoto")}
        >
          {preview}
        </button>
      ) : (
        <div className={styles.photoPreview}>{preview}</div>
      )}
      {controller.isEditing && (
        <input
          ref={fileInputRef}
          className={styles.photoFileInput}
          type="file"
          accept={PRODUCT_PHOTO_FILE_TYPES.join(",")}
          onChange={choosePhoto}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      {photoError && <small className={styles.photoUploadError} role="alert">{photoError}</small>}
      {variant === "edit" ? (
        <div className={styles.editPhotoFields}>
          {barcodeField}
          {photoUrlField}
        </div>
      ) : (
        <>{photoUrlField}{barcodeField}</>
      )}
    </section>
  );
}
