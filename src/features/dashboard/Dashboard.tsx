import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Clock3, RefreshCw, Store } from "lucide-react";
import type { DashboardResponse } from "@server/db/dashboard/dashboardModel";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { loadDashboard } from "./dashboardClient";
import { DashboardSalesChart } from "./DashboardSalesChart";
import { DashboardStockPanel } from "./DashboardStockPanel";
import { DashboardSummary } from "./DashboardSummary";
import styles from "./Dashboard.module.css";

export function Dashboard() {
  const { t, formatDate, formatMoney, formatNumber } = usePreferences();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setIsRefreshing(true);
    setError(null);
    void loadDashboard(controller.signal)
      .then(setDashboard)
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : t("dashboard.error"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRefreshing(false);
      });
    return () => controller.abort();
  }, [refreshVersion, t]);

  const refresh = useCallback(() => {
    if (!isRefreshing) setRefreshVersion((version) => version + 1);
  }, [isRefreshing]);

  if (!dashboard && isRefreshing) {
    return (
      <main className={styles.page} aria-busy="true" aria-label={t("dashboard.loading")}>
        <div className={styles.content}>
          <div className={styles.headerSkeleton} />
          <div className={styles.summarySkeleton}>
            {[0, 1, 2, 3, 4].map((item) => <span key={item} />)}
          </div>
          <div className={styles.bodySkeleton}><span /><span /></div>
        </div>
      </main>
    );
  }

  if (!dashboard) {
    return (
      <main className={styles.page}>
        <div className={styles.centeredState} role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <h1>{t("dashboard.error")}</h1>
          <p>{error}</p>
          <button type="button" onClick={refresh}>
            <RefreshCw size={15} aria-hidden="true" />
            {t("dashboard.retry")}
          </button>
        </div>
      </main>
    );
  }

  const storeName = dashboard.store.name || t("dashboard.storeFallback");
  const hasHours = Boolean(dashboard.store.openingTime && dashboard.store.closingTime);
  const statusLabel = dashboard.store.isOpen === null
    ? null
    : t(dashboard.store.isOpen ? "dashboard.open" : "dashboard.closed");

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <h1>{t("dashboard.overview")}</h1>
            <div className={styles.storeLine}>
              <Store size={14} aria-hidden="true" />
              <span>{storeName}</span>
              <span aria-hidden="true">·</span>
              <span>{formatDate(dashboard.date + "T00:00:00+07:00", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}</span>
            </div>
          </div>

          <div className={styles.headerMeta}>
            <div className={styles.hoursBlock}>
              <Clock3 size={15} aria-hidden="true" />
              <div>
                <span>{hasHours
                  ? dashboard.store.openingTime + "–" + dashboard.store.closingTime
                  : t("dashboard.hoursNotSet")}</span>
                {statusLabel && (
                  <small className={dashboard.store.isOpen ? styles.open : styles.closed}>
                    {statusLabel}
                  </small>
                )}
              </div>
            </div>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={refresh}
              disabled={isRefreshing}
              aria-label={t("dashboard.refreshLabel")}
            >
              <RefreshCw
                size={15}
                className={isRefreshing ? styles.spinning : undefined}
                aria-hidden="true"
              />
              <span>{t("dashboard.updated", {
                time: formatDate(dashboard.generatedAt, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className={styles.staleNotice} role="status">
            <AlertCircle size={15} aria-hidden="true" />
            <span>{t("dashboard.staleData")}</span>
            <button type="button" onClick={refresh}>{t("dashboard.retry")}</button>
          </div>
        )}

        <DashboardSummary
          dashboard={dashboard}
          formatMoney={formatMoney}
          formatNumber={formatNumber}
          t={t}
        />

        <div className={styles.primaryGrid}>
          <DashboardSalesChart
            dashboard={dashboard}
            formatMoney={formatMoney}
            formatNumber={formatNumber}
            t={t}
          />
          <DashboardStockPanel
            inventory={dashboard.inventory}
            formatDate={formatDate}
            formatNumber={formatNumber}
            t={t}
          />
        </div>
      </div>
    </main>
  );
}
