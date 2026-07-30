import type { PurchaseWorkflow } from "./usePurchaseWorkflow";
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

export function PurchaseLineTable({ workflow }: { workflow: PurchaseWorkflow }) {
  const { t, purchaseLines, setPurchaseLines, isEditable, localizeUnit } = workflow;
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
                    <tr key={line.id}>
                      <td>
                        <button
                          type="button"
                          className={styles.removeLineButton}
                          aria-label={`Remove ${line.itemName}`}
                          disabled={!isEditable}
                          onClick={() => setPurchaseLines(lines => lines.filter(candidate => candidate.id !== line.id))}
                        >
                          <IconBin />
                        </button>
                      </td>
                      <td>
                        <div className={styles.purchaseLineItem}>
                          <img src={line.imageUrl} alt="" />
                          <span>{line.itemName}</span>
                        </div>
                      </td>
                      <td>{line.qty} {localizeUnit(line.unit)}</td>
                      <td>฿{line.cost}</td>
                      <td>{line.freeQty ? `${line.freeQty} ${localizeUnit(line.freeUnit)}` : "-"}</td>
                      <td>{line.lotNo || "-"}</td>
                      <td>{line.expiryDate || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
    </div>
  );
}
