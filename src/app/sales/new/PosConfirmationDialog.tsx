"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import styles from "./NewSale.module.css";

export function PosConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      if (event.shiftKey && document.activeElement === cancelButtonRef.current) {
        event.preventDefault();
        confirmButtonRef.current?.focus();
      } else if (!event.shiftKey && document.activeElement === confirmButtonRef.current) {
        event.preventDefault();
        cancelButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.confirmBackdrop} onMouseDown={onCancel}>
      <div
        className={styles.confirmDialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pos-confirm-title"
        aria-describedby="pos-confirm-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className={styles.confirmIcon}><AlertTriangle size={20} aria-hidden="true" /></span>
        <div className={styles.confirmCopy}>
          <h2 id="pos-confirm-title">{title}</h2>
          <p id="pos-confirm-description">{description}</p>
        </div>
        <div className={styles.confirmActions}>
          <button ref={cancelButtonRef} type="button" className={styles.confirmCancel} onClick={onCancel}>Keep working</button>
          <button ref={confirmButtonRef} type="button" className={styles.confirmProceed} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
