"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { SalesProduct } from "@/server/db/types";
import { usePreferences } from "@/app/PreferencesProvider";
import { localizeUnitExpression } from "@/app/i18n/productUnits";
import { invalidateStockCatalog, loadStockProductsByIds } from "../stockCatalogClient";
import styles from "./StockAdjustment.module.css";

type PharmUser = {
  name: string;
  role: "owner" | "pharmacist";
  canManageStock: boolean;
};

type CorrectionRequest = {
  id: string;
  purchaseBillId: string;
  billNo: string;
  invoiceNo: string;
  distributor: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedAt: string;
};

type PurchaseLine = {
  id: string;
  productId: string;
  itemName: string;
  batchNo: string;
  unit: string;
};

type PurchaseBill = {
  id: string;
  billNo: string;
  invoiceNo: string;
  date: string;
  distributor: string;
  status: "draft" | "partial" | "received";
  lines: PurchaseLine[];
};

type AdjustmentLine = {
  key: string;
  productId: string;
  itemName: string;
  batchNo: string;
  currentQuantity: number;
  newQuantity: string;
  stockUnit: string;
  found: boolean;
};

type StockAdjustmentProps = {
  initialPurchaseId?: string;
  initialRequestId?: string;
};

const readError = async (response: Response, fallback: string) => {
  try {
    const data = await response.json() as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
};

const dateTime = (value: string) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

const parseAdjustmentQuantity = (value: string) => {
  if (!value.trim()) return null;
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity >= 0 ? quantity : null;
};

function buildAdjustmentLines(bill: PurchaseBill, catalog: SalesProduct[]): AdjustmentLine[] {
  const lines = new Map<string, AdjustmentLine>();
  for (const purchaseLine of bill.lines) {
    const product = catalog.find(candidate => candidate.id === purchaseLine.productId);
    const batch = product?.batches.find(candidate => candidate.batchNo === purchaseLine.batchNo);
    const key = `${purchaseLine.productId}::${purchaseLine.batchNo}`;
    if (lines.has(key)) continue;
    const currentQuantity = batch?.availableStock ?? 0;
    lines.set(key, {
      key,
      productId: purchaseLine.productId,
      itemName: purchaseLine.itemName,
      batchNo: purchaseLine.batchNo,
      currentQuantity,
      newQuantity: String(currentQuantity),
      stockUnit: product?.pack.childUnit || purchaseLine.unit,
      found: Boolean(product && batch),
    });
  }
  return [...lines.values()];
}

export function StockAdjustment({ initialPurchaseId, initialRequestId }: StockAdjustmentProps) {
  const { preferences } = usePreferences();
  const [user, setUser] = useState<PharmUser | null>(null);
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState(initialRequestId ?? "");
  const [bill, setBill] = useState<PurchaseBill | null>(null);
  const [lines, setLines] = useState<AdjustmentLine[]>([]);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const initializedRequestId = useRef("");

  const selectedRequest = useMemo(
    () => requests.find(request => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const loadQueue = useCallback(async () => {
    const response = await fetch("/api/purchase-corrections", { cache: "no-store" });
    if (!response.ok) throw new Error(await readError(response, "Unable to load correction requests."));
    const data = await response.json() as { requests?: CorrectionRequest[] };
    setRequests(Array.isArray(data.requests) ? data.requests : []);
  }, []);

  const refreshQueue = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      await loadQueue();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load correction requests.");
    } finally {
      setIsLoading(false);
    }
  }, [loadQueue]);

  const loadBill = useCallback(async (nextPurchaseId: string) => {
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const billResponse = await fetch(
        `/api/purchase?id=${encodeURIComponent(nextPurchaseId)}`,
        { cache: "no-store" },
      );
      if (!billResponse.ok) throw new Error(await readError(billResponse, "Unable to load purchase bill."));
      const data = await billResponse.json() as { bill?: PurchaseBill };
      if (!data.bill || data.bill.status !== "received") {
        throw new Error("Only completed purchase bills can be adjusted.");
      }
      const products = await loadStockProductsByIds(data.bill.lines.map((line) => line.productId));
      setBill(data.bill);
      setLines(buildAdjustmentLines(data.bill, products));
    } catch (loadError) {
      setBill(null);
      setLines([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load purchase adjustment.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/current-user", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to verify stock adjustment access.");
        const data = await response.json() as { user?: PharmUser };
        if (!data.user) throw new Error("Unable to verify stock adjustment access.");
        if (cancelled) return;
        setUser(data.user);
        if (!data.user.canManageStock) return;
        await loadQueue();
        if (!cancelled && initialPurchaseId) await loadBill(initialPurchaseId);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load stock adjustment.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [initialPurchaseId, loadBill, loadQueue]);

  useEffect(() => {
    if (!selectedRequest || initializedRequestId.current === selectedRequest.id) return;
    initializedRequestId.current = selectedRequest.id;
    setReason(selectedRequest.reason);
    if (bill?.id !== selectedRequest.purchaseBillId) void loadBill(selectedRequest.purchaseBillId);
  }, [bill?.id, loadBill, selectedRequest]);

  const changedLines = useMemo(() => lines.filter(line => {
    const next = parseAdjustmentQuantity(line.newQuantity);
    return line.found && next !== null && next !== line.currentQuantity;
  }), [lines]);

  const invalidLine = lines.some(line => {
    return !line.found || parseAdjustmentQuantity(line.newQuantity) === null;
  });

  const canApply = Boolean(
    bill
    && reason.trim().length >= 8
    && changedLines.length > 0
    && !invalidLine
    && !isSaving,
  );

  const selectRequest = (request: CorrectionRequest) => {
    setSelectedRequestId(request.id);
  };

  const applyAdjustment = async () => {
    if (!bill || !canApply) return;
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/stock-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseBillId: bill.id,
          correctionRequestId: selectedRequest?.id,
          reason: reason.trim(),
          lines: changedLines.map(line => ({
            productId: line.productId,
            batchNo: line.batchNo,
            newQuantity: parseAdjustmentQuantity(line.newQuantity),
          })),
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "Unable to save stock adjustment."));
      invalidateStockCatalog();
      const successMessage = selectedRequest ? "Correction approved and stock updated." : "Stock adjustment saved.";
      setSelectedRequestId("");
      await loadQueue();
      await loadBill(bill.id);
      setSuccess(successMessage);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save stock adjustment.");
    } finally {
      setIsSaving(false);
    }
  };

  const rejectRequest = async () => {
    if (!selectedRequest || isSaving) return;
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/purchase-corrections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          requestId: selectedRequest.id,
          reviewNote: reason.trim() || "Rejected by stock manager",
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "Unable to reject correction request."));
      setSuccess("Correction request rejected. Stock was not changed.");
      setSelectedRequestId("");
      setReason("");
      await loadQueue();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to reject correction request.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user && isLoading) {
    return <main className={styles.page}><div className={styles.centerState}>Loading stock adjustment…</div></main>;
  }

  if (user && !user.canManageStock) {
    return (
      <main className={styles.page}>
        <div className={styles.restrictedCard}>
          <ShieldCheck size={30} />
          <h1>Owner or admin access required</h1>
          <p>Staff can submit a correction reason from the completed purchase bill. Stock remains unchanged until it is reviewed.</p>
          <Link to="/purchase"><ArrowLeft size={15} /> Back to purchases</Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <div className={styles.restrictedCard}>
          <AlertCircle size={30} />
          <h1>Stock adjustment unavailable</h1>
          <p>{error || "The current user could not be verified."}</p>
          <Link to="/purchase"><ArrowLeft size={15} /> Back to purchases</Link>
        </div>
      </main>
    );
  }

  const pendingRequests = requests.filter(request => request.status === "pending");
  const reviewedRequests = requests.filter(request => request.status !== "pending").slice(0, 8);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.breadcrumb}><Link to="/stock">Stock</Link><span>/</span><strong>Adjustment</strong></div>
          <h1>Purchase stock corrections</h1>
          <p>Review the completed bill, record the reason, then save only the stock difference.</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => void refreshQueue()} disabled={isLoading || isSaving}>
          <RefreshCw size={15} /> Refresh
        </button>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.queuePanel}>
          <div className={styles.panelHeading}>
            <div><span>Staff requests</span><strong>{pendingRequests.length} pending</strong></div>
            <ClipboardList size={18} />
          </div>
          <div className={styles.requestList}>
            {pendingRequests.length === 0 ? (
              <div className={styles.emptyQueue}><CheckCircle2 size={22} /><span>No pending corrections</span></div>
            ) : pendingRequests.map(request => (
              <button
                type="button"
                key={request.id}
                className={`${styles.requestCard} ${selectedRequestId === request.id ? styles.requestCardActive : ""}`}
                onClick={() => selectRequest(request)}
              >
                <span className={styles.requestTopline}><strong>{request.billNo}</strong><small>{dateTime(request.requestedAt)}</small></span>
                <span className={styles.requestDistributor}>{request.distributor}</span>
                <span className={styles.requestReason}>{request.reason}</span>
                <span className={styles.requestUser}>Requested by {request.requestedBy}</span>
              </button>
            ))}
            {reviewedRequests.length > 0 && (
              <div className={styles.reviewHistory}>
                <span>Recent decisions</span>
                {reviewedRequests.map(request => (
                  <div key={request.id}>
                    <strong>{request.billNo}</strong>
                    <small className={request.status === "approved" ? styles.approvedText : styles.rejectedText}>
                      {request.status}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className={styles.editorPanel}>
          {!bill ? (
            <div className={styles.editorEmpty}>
              {isLoading ? <RefreshCw className={styles.spin} size={26} /> : <ClipboardList size={28} />}
              <h2>{isLoading ? "Loading purchase bill" : error ? "Unable to load adjustment" : "Select a correction request"}</h2>
              <p>{error || "Owner/admin can also open a completed bill and choose Adjust stock."}</p>
            </div>
          ) : (
            <>
              <div className={styles.billHeader}>
                <div className={styles.billIdentity}>
                  <span>Completed purchase</span>
                  <h2>{bill.billNo}</h2>
                  <p>{bill.distributor} · Invoice {bill.invoiceNo || "—"}</p>
                </div>
                <div className={styles.billLinks}>
                  <span>{new Intl.DateTimeFormat("en-GB").format(new Date(bill.date))}</span>
                  <Link to={`/purchase/new?id=${encodeURIComponent(bill.id)}`}>View original bill</Link>
                </div>
              </div>

              {selectedRequest && (
                <div className={styles.requestNotice}>
                  <AlertCircle size={17} />
                  <div><strong>Staff correction reason</strong><p>{selectedRequest.reason}</p></div>
                </div>
              )}

              <div className={styles.tableWrap}>
                <table>
                  <thead><tr><th>Item / batch</th><th>Current stock</th><th>New stock</th><th>Difference</th></tr></thead>
                  <tbody>
                    {lines.map(line => {
                      const next = parseAdjustmentQuantity(line.newQuantity);
                      const delta = next === null ? 0 : next - line.currentQuantity;
                      return (
                        <tr key={line.key} className={!line.found ? styles.invalidRow : ""}>
                          <td><strong>{line.itemName}</strong><small>Batch {line.batchNo || "missing"} · {localizeUnitExpression(preferences.locale, line.stockUnit)}</small></td>
                          <td><span className={styles.quantityValue}>{line.currentQuantity.toLocaleString("en-US")}</span></td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.newQuantity}
                              disabled={!line.found || isSaving}
                              aria-label={`New stock for ${line.itemName}, batch ${line.batchNo}`}
                              onChange={event => setLines(current => current.map(candidate => candidate.key === line.key
                                ? { ...candidate, newQuantity: event.target.value }
                                : candidate))}
                            />
                            {!line.found && <small className={styles.rowError}>Batch not found in stock</small>}
                          </td>
                          <td><span className={`${styles.delta} ${delta > 0 ? styles.deltaPositive : delta < 0 ? styles.deltaNegative : ""}`}>{delta > 0 ? "+" : ""}{delta.toLocaleString("en-US")}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.reasonSection}>
                <label htmlFor="adjustment-reason">Adjustment reason</label>
                <textarea
                  id="adjustment-reason"
                  value={reason}
                  maxLength={500}
                  disabled={isSaving}
                  placeholder="Explain what was wrong and what was verified before changing stock."
                  onChange={event => setReason(event.target.value)}
                />
                <span>{reason.trim().length}/500 · minimum 8 characters</span>
              </div>

              {(error || success) && (
                <div className={success ? styles.successMessage : styles.errorMessage} role="status">
                  {success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{success || error}
                </div>
              )}

              <footer className={styles.actions}>
                <div><strong>{changedLines.length}</strong><span>changed batch{changedLines.length === 1 ? "" : "es"}</span></div>
                {selectedRequest && (
                  <button type="button" className={styles.rejectButton} onClick={() => void rejectRequest()} disabled={isSaving}>
                    <XCircle size={16} /> Reject request
                  </button>
                )}
                <button type="button" className={styles.applyButton} onClick={() => void applyAdjustment()} disabled={!canApply}>
                  <ShieldCheck size={16} /> {isSaving ? "Saving…" : selectedRequest ? "Approve & update stock" : "Save stock adjustment"}
                </button>
              </footer>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
