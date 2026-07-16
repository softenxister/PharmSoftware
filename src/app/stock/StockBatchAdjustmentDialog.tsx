"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Package, X } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
import {
  calculateStockAdjustment,
  MAX_DIRECT_STOCK_QUANTITY,
} from "@/lib/directStockAdjustment";
import type { SalesProduct } from "@/server/db/types";
import styles from "./Stock.module.css";

type StockBatchAdjustmentDialogProps = {
  product: SalesProduct;
  onClose: () => void;
  onUpdated: (
    productId: string,
    quantities: Array<{ batchNo: string; availableStock: number }>,
  ) => void;
};

function formatChange(value: number | null): string {
  if (value === null) return "—";
  if (value > 0) return `+${value}`;
  return String(value);
}

export function StockBatchAdjustmentDialog({
  product,
  onClose,
  onUpdated,
}: StockBatchAdjustmentDialogProps) {
  const { t, formatNumber } = usePreferences();
  const dialogRef = useRef<HTMLElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState(() => product.batches.map((batch) => ({
    batchNo: batch.batchNo,
    currentQuantity: batch.availableStock,
    newQuantity: String(batch.availableStock),
  })));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const calculation = useMemo(() => calculateStockAdjustment(drafts), [drafts]);

  useEffect(() => {
    firstInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
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
  }, [isSubmitting, onClose]);

  const handleQuantityChange = (batchNo: string, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setError("");
    setDrafts((current) => current.map((draft) => (
      draft.batchNo === batchNo ? { ...draft, newQuantity: value } : draft
    )));
  };

  const handleSubmit = async () => {
    if (!calculation.isValid || !calculation.hasChanges || isSubmitting) return;
    const lines = calculation.lines.flatMap((line) => (
      line.change !== 0 && line.parsedQuantity !== null
        ? [{ batchNo: line.batchNo, newQuantity: line.parsedQuantity }]
        : []
    ));
    if (lines.length === 0) return;

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/stock/batch-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, lines }),
      });
      const data = await response.json() as {
        productId?: string;
        quantities?: Array<{ batchNo: string; availableStock: number }>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || t("stock.adjustmentSaveError"));
      }
      const hasValidQuantities = Array.isArray(data.quantities) && data.quantities.every((quantity) => (
        quantity
        && typeof quantity.batchNo === "string"
        && Number.isSafeInteger(quantity.availableStock)
        && quantity.availableStock >= 0
      ));
      if (data.productId !== product.id || !hasValidQuantities) {
        throw new Error(t("stock.adjustmentSaveError"));
      }
      onUpdated(data.productId, data.quantities);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("stock.adjustmentSaveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.adjustmentBackdrop}
      role="presentation"
      onMouseDown={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.adjustmentDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-adjustment-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.adjustmentHeader}>
          <span className={styles.adjustmentImageFrame}>
            {product.imageUrl ? (
              <img src={product.imageUrl} alt="" className={styles.adjustmentImage} />
            ) : (
              <Package size={30} aria-hidden="true" />
            )}
          </span>
          <span className={styles.adjustmentProductInfo}>
            <h2 id="stock-adjustment-title">{product.itemName}</h2>
            <span className={styles.adjustmentProductMeta}>
              <span>{product.manufacturerName}</span>
              <span aria-hidden="true">|</span>
              <span>{product.pack.label}</span>
            </span>
          </span>
          <button
            type="button"
            className={styles.adjustmentCloseButton}
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={t("stock.closeAdjustment")}
          >
            <X size={19} />
          </button>
        </header>

        <div className={styles.adjustmentTableWrap}>
          <table className={styles.adjustmentTable}>
            <thead>
              <tr>
                <th>{t("stock.batch")}</th>
                <th>{t("stock.expiry")}</th>
                <th>{t("stock.price")}</th>
                <th>{t("stock.cost")}</th>
                <th>{t("stock.quantityShort")}</th>
                <th>{t("stock.newQuantity")}</th>
                <th>{t("stock.change")}</th>
              </tr>
            </thead>
            <tbody>
              {product.batches.map((batch, index) => {
                const calculated = calculation.lines[index];
                const change = calculated?.change ?? null;
                return (
                  <tr key={batch.batchNo}>
                    <td className={styles.adjustmentBatch}>{batch.batchNo}</td>
                    <td>{batch.expiryDate || "—"}</td>
                    <td>฿{formatNumber(batch.sellPriceThb, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>{batch.costThb === undefined ? "—" : `฿${formatNumber(batch.costThb, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
                    <td className={styles.adjustmentCurrentQuantity}>{formatNumber(batch.availableStock)}</td>
                    <td>
                      <input
                        ref={index === 0 ? firstInputRef : undefined}
                        className={styles.adjustmentQuantityInput}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={drafts[index]?.newQuantity ?? ""}
                        onChange={(event) => handleQuantityChange(batch.batchNo, event.target.value)}
                        aria-label={t("stock.newQuantityFor", { batch: batch.batchNo })}
                        aria-invalid={calculated?.parsedQuantity === null}
                        disabled={isSubmitting}
                        maxLength={String(MAX_DIRECT_STOCK_QUANTITY).length}
                      />
                    </td>
                    <td className={`${styles.adjustmentChange} ${
                      change !== null && change > 0
                        ? styles.adjustmentChangePositive
                        : change !== null && change < 0
                          ? styles.adjustmentChangeNegative
                          : ""
                    }`}>
                      {formatChange(change)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {product.batches.length === 0 && (
            <div className={styles.adjustmentEmpty}>{t("stock.noBatches")}</div>
          )}
        </div>

        <footer className={styles.adjustmentFooter}>
          <div className={styles.adjustmentTotals} aria-live="polite">
            <span>{t("stock.currentTotal")} <strong>{formatNumber(calculation.currentTotal)}</strong></span>
            <span>{t("stock.finalTotal")} <strong>{calculation.isValid ? formatNumber(calculation.finalTotal) : "—"}</strong></span>
            <span className={calculation.totalChange > 0 ? styles.adjustmentChangePositive : calculation.totalChange < 0 ? styles.adjustmentChangeNegative : ""}>
              {t("stock.totalChange")} <strong>{calculation.isValid ? formatChange(calculation.totalChange) : "—"}</strong>
            </span>
          </div>
          {error && <p className={styles.adjustmentError} role="alert">{error}</p>}
          <button
            type="button"
            className={styles.adjustmentSubmitButton}
            onClick={() => void handleSubmit()}
            disabled={!calculation.isValid || !calculation.hasChanges || isSubmitting}
          >
            {isSubmitting ? t("stock.savingAdjustment") : t("stock.submitAdjustment")}
          </button>
        </footer>
      </section>
    </div>
  );
}
