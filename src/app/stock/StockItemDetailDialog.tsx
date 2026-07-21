"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Package, X } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
import type { PharmUserRole } from "@/server/auth/pharmUser";
import type { SalesProduct } from "@/server/db/types";
import type { StockDefaultDosage, StockItemDetailPatch } from "@/server/db/stockItemDetail";
import { canonicalizeStockCategory, getStockCategoryOptions } from "./stockCategoryFilter";
import { SearchableSelect } from "./StockEntryForm";
import styles from "./Stock.module.css";

type StockItemDetailDialogProps = {
  product: SalesProduct;
  role: PharmUserRole;
  onClose: () => void;
  onSaved: (product: SalesProduct) => void;
};

const DOSAGE_TIMES = ["8 AM", "1 PM", "7 PM", "10 PM"] as const;

const PillIcon = () => (
  <svg viewBox="0 0 22 22" width="16" height="16" aria-hidden="true">
    <g transform="rotate(-35 11 11)">
      <rect x="3.5" y="7" width="15" height="8" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11 7v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </g>
  </svg>
);

const digitsOnly = (value: string) => value.replace(/\D/g, "");

function ToggleControl({
  checked,
  disabled = false,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  hint: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={`${styles.itemDetailToggleRow} ${disabled ? styles.itemDetailControlDisabled : ""}`}>
      <span className={styles.itemDetailToggleCopy}>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <button
        type="button"
        className={`${styles.itemDetailSwitch} ${checked ? styles.itemDetailSwitchOn : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export function StockItemDetailDialog({ product, role, onClose, onSaved }: StockItemDetailDialogProps) {
  const { t, preferences } = usePreferences();
  const dialogRef = useRef<HTMLElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [location, setLocation] = useState(product.location);
  const [category, setCategory] = useState(canonicalizeStockCategory(product.category));
  const [discountPercent, setDiscountPercent] = useState(String(product.discountPercent ?? 0));
  const [minimumStock, setMinimumStock] = useState(String(product.minimumStock ?? 20));
  const [maximumStock, setMaximumStock] = useState(String(product.maximumStock ?? 200));
  const [isDiscountLocked, setIsDiscountLocked] = useState(product.isDiscountLocked ?? false);
  const [isReturnable, setIsReturnable] = useState(product.isReturnable ?? true);
  const [defaultDosage, setDefaultDosage] = useState<string[]>(() => (
    product.defaultDosage ?? [0, 0, 0, 0]
  ).map(String));
  const [tagName, setTagName] = useState(product.tagName ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const isOwner = role === "owner";
  const categoryOptions = useMemo(
    () => getStockCategoryOptions(preferences.locale),
    [preferences.locale],
  );
  const numericTextValues = [minimumStock, maximumStock, discountPercent, ...defaultDosage];
  const numericValues = numericTextValues.map(Number);
  const [parsedMinimum, parsedMaximum, parsedDiscount, ...parsedDosage] = numericValues;
  const hasValidWholeNumbers = numericValues.every((value) => Number.isSafeInteger(value));
  const canSave = Boolean(location.trim() && category.trim())
    && tagName.trim().length <= 60
    && numericTextValues.every((value) => value.trim().length > 0)
    && hasValidWholeNumbers
    && parsedMinimum >= 0
    && parsedMaximum >= parsedMinimum
    && parsedMaximum <= 1_000_000
    && parsedDiscount >= 0
    && parsedDiscount <= 100
    && parsedDosage.every((dose) => dose >= 0 && dose <= 99)
    && !isSaving;

  useEffect(() => {
    firstInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  const updateDosage = (index: number, value: string) => {
    setDefaultDosage((current) => current.map((dose, doseIndex) => (
      doseIndex === index ? digitsOnly(value).slice(0, 2) : dose
    )));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const input: StockItemDetailPatch = {
      productId: product.id,
      location: location.trim(),
      category: canonicalizeStockCategory(category),
      minimumStock: parsedMinimum,
      maximumStock: parsedMaximum,
      discountPercent: parsedDiscount,
      isDiscountLocked,
      isReturnable,
      defaultDosage: parsedDosage as StockDefaultDosage,
      tagName: tagName.trim(),
    };
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json() as { product?: SalesProduct; error?: string };
      if (!response.ok || !data.product) {
        throw new Error(data.error || t("stock.itemDetailSaveError"));
      }
      onSaved(data.product);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("stock.itemDetailSaveError"));
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.adjustmentBackdrop} role="presentation" onMouseDown={() => !isSaving && onClose()}>
      <section
        ref={dialogRef}
        className={`${styles.adjustmentDialog} ${styles.itemDetailDialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-item-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.adjustmentHeader}>
          <span className={styles.adjustmentImageFrame}>
            {product.imageUrl ? <img src={product.imageUrl} alt="" className={styles.adjustmentImage} /> : <Package size={30} />}
          </span>
          <span className={styles.adjustmentProductInfo}>
            <h2 id="set-item-detail-title">{t("stock.setItemDetail")}</h2>
            <span className={styles.adjustmentProductMeta}>
              <span>{product.itemName}</span><span aria-hidden="true">|</span>
              <span>{product.manufacturerName}</span><span aria-hidden="true">|</span>
              <span>{product.pack.label}</span>
            </span>
          </span>
          <button type="button" className={styles.adjustmentCloseButton} onClick={onClose} disabled={isSaving} aria-label={t("stock.closeItemDetail")}>
            <X size={19} />
          </button>
        </header>

        <form className={styles.itemDetailForm} onSubmit={handleSubmit}>
          <div className={styles.itemDetailMainGrid}>
            <label className={styles.itemDetailField}>
              <span>{t("stockForm.location")}</span>
              <input ref={firstInputRef} value={location} maxLength={80} onChange={(event) => setLocation(event.target.value)} />
            </label>
            <label className={styles.itemDetailField}>
              <span>{t("stock.category")}</span>
              <SearchableSelect ariaLabel={t("stock.category")} value={category} options={categoryOptions} onChange={setCategory} />
            </label>
            <label className={styles.itemDetailField}>
              <span>{t("stock.discountPercent")}</span>
              <input value={discountPercent} inputMode="numeric" disabled={!isOwner} maxLength={3} onChange={(event) => setDiscountPercent(digitsOnly(event.target.value))} />
              {!isOwner && <small>{t("stock.ownerOnly")}</small>}
            </label>
            <label className={styles.itemDetailField}>
              <span>{t("stock.minimumStock")}</span>
              <input value={minimumStock} inputMode="numeric" maxLength={7} onChange={(event) => setMinimumStock(digitsOnly(event.target.value))} />
            </label>
            <label className={styles.itemDetailField}>
              <span>{t("stock.maximumStock")}</span>
              <input value={maximumStock} inputMode="numeric" maxLength={7} onChange={(event) => setMaximumStock(digitsOnly(event.target.value))} />
            </label>
          </div>

          <div className={styles.itemDetailToggleGrid}>
            <ToggleControl checked={isDiscountLocked} disabled={!isOwner} label={t("stock.lockDiscount")} hint={isOwner ? t("stock.lockDiscountHint") : t("stock.ownerOnly")} onChange={setIsDiscountLocked} />
            <ToggleControl checked={isReturnable} label={t("stock.returnable")} hint={t("stock.returnableHint")} onChange={setIsReturnable} />
          </div>

          <section className={styles.itemDetailDosageSection} aria-labelledby="default-dosage-title">
            <div className={styles.itemDetailSectionTitle}>
              <span className={styles.itemDetailSectionIcon}><PillIcon /></span>
              <span><strong id="default-dosage-title">{t("stock.defaultDosage")}</strong><small>{t("stock.defaultDosageHint")}</small></span>
            </div>
            <div className={styles.itemDetailDosageGrid}>
              {DOSAGE_TIMES.map((time, index) => (
                <label key={time} className={styles.itemDetailDoseField}>
                  <span>{time}</span>
                  <input value={defaultDosage[index]} inputMode="numeric" maxLength={2} aria-label={t("stock.defaultDoseAt", { time })} onChange={(event) => updateDosage(index, event.target.value)} />
                </label>
              ))}
            </div>
          </section>

          <label className={`${styles.itemDetailField} ${styles.itemDetailTagField}`}>
            <span>{t("stock.tagName")}</span>
            <input value={tagName} maxLength={60} placeholder={t("stock.tagNamePlaceholder")} onChange={(event) => setTagName(event.target.value)} />
            <small>{t("stock.tagNameHint")}</small>
          </label>

          <footer className={`${styles.adjustmentFooter} ${styles.itemDetailFooter}`}>
            <span className={styles.itemDetailValidationHint}>
              {!canSave && !isSaving ? t("stock.itemDetailValidation") : ""}
            </span>
            {error && <p className={styles.adjustmentError} role="alert">{error}</p>}
            <span className={styles.itemDetailFooterActions}>
              <button type="button" className={styles.itemDetailCancelButton} onClick={onClose} disabled={isSaving}>{t("staff.cancel")}</button>
              <button type="submit" className={styles.adjustmentSubmitButton} disabled={!canSave}>{isSaving ? t("common.saving") : t("stock.saveItemDetail")}</button>
            </span>
          </footer>
        </form>
      </section>
    </div>
  );
}
