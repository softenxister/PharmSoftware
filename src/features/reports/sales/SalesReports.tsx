import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, Printer, RefreshCw, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router";
import { useAuth } from "@/app/providers/AuthProvider";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { SalesReportResponse, SalesReportRow, SalesReportView } from "@server/db/reports/salesReportModel";
import { loadSalesReport, reportExportUrl } from "./salesReportClient";
import {
  periodForRange,
  reportSearchParams,
  resolveSalesReportLocation,
  type SalesReportLocation,
  type SalesReportRange,
} from "./salesReportModel";
import { SalesReportDetailDrawer } from "./SalesReportDetailDrawer";
import { SalesReportFilters } from "./SalesReportFilters";
import { SalesReportMetrics } from "./SalesReportMetrics";
import { SalesReportSelector } from "./SalesReportSelector";
import { SalesReportTable } from "./SalesReportTable";
import styles from "./SalesReports.module.css";

export function SalesReports() {
  const { user } = useAuth();
  const { preferences, t, formatDate, formatMoney, formatNumber } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const [report, setReport] = useState<SalesReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [selectedRow, setSelectedRow] = useState<SalesReportRow | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const canViewProfit = user?.role === "owner";
  const location = useMemo(() => resolveSalesReportLocation(
    searchParams,
    preferences.analysisDefaultRange,
    canViewProfit,
  ), [canViewProfit, preferences.analysisDefaultRange, searchParams]);
  const [draftFrom, setDraftFrom] = useState(location.from);
  const [draftTo, setDraftTo] = useState(location.to);

  useEffect(() => {
    setDraftFrom(location.from);
    setDraftTo(location.to);
  }, [location.from, location.to]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    void loadSalesReport(location, controller.signal)
      .then((nextReport) => setReport(nextReport))
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setReport(null);
        setError(loadError instanceof Error ? loadError.message : t("reports.error"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [location.from, location.page, location.to, location.view, retryVersion, t]);

  const navigateTo = useCallback((next: SalesReportLocation) => {
    setSelectedRow(null);
    setSearchParams(reportSearchParams(next));
  }, [setSearchParams]);

  const selectView = (view: SalesReportView) => navigateTo({ ...location, view, page: 1 });
  const selectRange = (range: SalesReportRange) => {
    if (range === "custom") {
      navigateTo({ ...location, range, page: 1 });
      return;
    }
    const period = periodForRange(range);
    navigateTo({ ...location, range, ...period, page: 1 });
  };
  const applyCustomRange = () => {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return;
    navigateTo({ ...location, range: "custom", from: draftFrom, to: draftTo, page: 1 });
  };
  const selectRow = (row: SalesReportRow) => {
    if (row.type === "daily") {
      if (!canViewProfit) return;
      navigateTo({ ...location, view: "bill-profit", range: "custom", from: row.date, to: row.date, page: 1 });
      return;
    }
    setSelectedRow(row);
  };
  const exportReport = () => {
    if (isExporting) return;
    setIsExporting(true);
    const link = document.createElement("a");
    link.href = reportExportUrl(location);
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => setIsExporting(false), 700);
  };

  const hasMissingCost = Boolean(report
    && report.canViewProfit
    && report.costCoverage.totalLines > report.costCoverage.pricedLines
    && (report.view === "daily" || report.view === "bill-profit" || report.view === "product-profit"));

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <div className={styles.titleBlock}>
            <span className={styles.eyebrow}>{t("reports.eyebrow")}</span>
            <h1>{t("reports.title")}</h1>
            <p>{t("reports.subtitle")}</p>
            <div className={styles.basis}>
              <ShieldCheck size={13} strokeWidth={1.9} aria-hidden="true" />
              <span><strong>{t("reports.calculationBasis")}:</strong> {t("reports.inclusiveVat")}</span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.secondaryButton} disabled={!report || isLoading || isExporting} onClick={exportReport}>
              <Download size={15} aria-hidden="true" />
              {t(isExporting ? "reports.exporting" : "reports.export")}
            </button>
            <button type="button" className={styles.secondaryButton} disabled={!report || isLoading} onClick={() => window.print()}>
              <Printer size={15} aria-hidden="true" />
              {t("reports.print")}
            </button>
          </div>
        </header>

        <section className={styles.workspace}>
          <SalesReportSelector view={location.view} canViewProfit={canViewProfit} onSelect={selectView} t={t} />
          <SalesReportFilters
            range={location.range}
            from={draftFrom}
            to={draftTo}
            onRangeChange={selectRange}
            onFromChange={setDraftFrom}
            onToChange={setDraftTo}
            onApply={applyCustomRange}
            t={t}
          />
        </section>

        {!canViewProfit && (
          <div className={styles.permissionNote}><ShieldCheck size={15} aria-hidden="true" />{t("reports.financialRestricted")}</div>
        )}

        {hasMissingCost && report && (
          <div className={styles.costNotice} role="status">
            <AlertCircle size={16} aria-hidden="true" />
            <div>
              <strong>{t("reports.costMissing")}</strong>
              <span>{t("reports.costCoverage", {
                priced: report.costCoverage.pricedLines,
                total: report.costCoverage.totalLines,
              })}</span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className={styles.loadingState} aria-busy="true" aria-label={t("reports.loading")}>
            <div className={styles.metricSkeletons}>{[0, 1, 2, 3].map((index) => <span key={index} />)}</div>
            <div className={styles.tableSkeleton}>{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div>
          </div>
        )}

        {!isLoading && error && (
          <div className={styles.messageState} role="alert">
            <AlertCircle size={22} aria-hidden="true" />
            <h2>{t("reports.error")}</h2>
            <p>{error}</p>
            <button type="button" onClick={() => setRetryVersion((version) => version + 1)}>
              <RefreshCw size={14} aria-hidden="true" />{t("reports.retry")}
            </button>
          </div>
        )}

        {!isLoading && !error && report && report.rows.length === 0 && (
          <div className={styles.messageState} role="status">
            <h2>{t("reports.noSales")}</h2>
            <p>{t("reports.noSalesHint")}</p>
            <button type="button" onClick={() => selectRange("30d")}>{t("reports.widenRange")}</button>
          </div>
        )}

        {!isLoading && !error && report && report.rows.length > 0 && (
          <>
            <SalesReportMetrics metrics={report.metrics} formatMoney={formatMoney} formatNumber={formatNumber} t={t} />
            <SalesReportTable
              report={report}
              formatDate={formatDate}
              formatMoney={formatMoney}
              formatNumber={formatNumber}
              onSelect={selectRow}
              t={t}
            />
            <nav className={styles.pagination} aria-label={t("reports.showing", { page: report.pagination.page, pages: report.pagination.totalPages })}>
              <span>{t("reports.showing", { page: report.pagination.page, pages: report.pagination.totalPages })}</span>
              <div>
                <button type="button" disabled={report.pagination.page <= 1} onClick={() => navigateTo({ ...location, page: location.page - 1 })}>{t("reports.previous")}</button>
                <button type="button" disabled={report.pagination.page >= report.pagination.totalPages} onClick={() => navigateTo({ ...location, page: location.page + 1 })}>{t("reports.next")}</button>
              </div>
            </nav>
          </>
        )}
      </div>

      <span className={styles.visuallyHidden} aria-live="polite">{isExporting ? t("reports.exporting") : ""}</span>
      <SalesReportDetailDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        formatDate={formatDate}
        formatMoney={formatMoney}
        formatNumber={formatNumber}
        t={t}
      />
    </main>
  );
}
