import { ProductImage } from "@/components/product/ProductImage";
import type { PurchaseLineTableModel } from "./usePurchaseWorkflow";
import { getPurchaseUnitDisplayValue, isPurchaseLineRowActivationKey } from "./purchaseDraft";
import styles from "../PurchaseEntry.module.css";

const IconBin = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <path
      d="M4 6.5h12M8 6.5V5a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 12 5v1.5M6 6.5l.6 9a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4l.6-9"
      fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

export function PurchaseLineTable({ model }: { model: PurchaseLineTableModel }) {
  const {
    t, purchaseLines, isEditable, localizeUnit, editLine, removeLine,
  } = model;
  const displayUnit = (value: string) => localizeUnit(getPurchaseUnitDisplayValue(value));
  if (purchaseLines.length === 0) return null;
  return (
    <div className={styles.purchaseLineTableWrap}>
              <table className={styles.purchaseLineTable} aria-label={t("purchaseEntry.lines")}>
                <thead>
                  <tr>
                    <th aria-hidden="true" />
                    <th>{t("newSale.item")}</th>
                    <th>{t("purchase.qty")}</th>
                    <th>{t("purchaseEntry.cost")}</th>
                    <th>{t("purchaseEntry.freeQty")}</th>
                    <th>{t("purchaseEntry.lotNo")}</th>
                    <th>{t("purchaseEntry.expDate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseLines.map(line => (
                    <tr
                      key={line.id}
                      className={isEditable ? styles.editablePurchaseLineRow : undefined}
                      tabIndex={isEditable ? 0 : undefined}
                      aria-label={isEditable ? t("purchaseEntry.editLine", { item: line.itemName }) : undefined}
                      onClick={() => {
                        if (isEditable) editLine(line);
                      }}
                      onKeyDown={(event) => {
                        if (
                          !isEditable
                          || event.target !== event.currentTarget
                          || !isPurchaseLineRowActivationKey(event.key)
                        ) return;
                        event.preventDefault();
                        editLine(line);
                      }}
                    >
                      <td>
                        <button
                          type="button"
                          className={styles.removeLineButton}
                          aria-label={`Remove ${line.itemName}`}
                          disabled={!isEditable}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeLine(line.id);
                          }}
                        >
                          <IconBin />
                        </button>
                      </td>
                      <td>
                        <div className={styles.purchaseLineItem}>
                          <ProductImage
                            src={line.imageUrl}
                            alt=""
                            width={38}
                            height={38}
                          />
                          <span>{line.itemName}</span>
                        </div>
                      </td>
                      <td>{line.qty} {displayUnit(line.unit)}</td>
                      <td>฿{line.cost}</td>
                      <td>{line.freeQty ? `${line.freeQty} ${displayUnit(line.freeUnit)}` : "-"}</td>
                      <td>{line.lotNo || "-"}</td>
                      <td>{line.expiryDate || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
    </div>
  );
}
