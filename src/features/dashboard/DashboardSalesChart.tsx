import { useEffect, useRef, type KeyboardEvent } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeftRight, CircleAlert } from "lucide-react";
import type { DashboardResponse } from "@server/db/dashboard/dashboardModel";
import type { TranslationKey, TranslationParams } from "@/i18n/i18n";
import { buildSalesYAxis } from "./dashboardChart";
import { scrollTimelineWithWheel } from "./dashboardInteraction";
import styles from "./Dashboard.module.css";

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

function SalesTooltip({
  active,
  payload,
  label,
  formatMoney,
  t,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number | null }>;
  label?: string;
  formatMoney: (value: number) => string;
  t: Translate;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <strong>{label}</strong>
      {payload.filter((entry) => entry.value !== null).map((entry) => (
        <span key={entry.dataKey}>
          {t(entry.dataKey === "today" ? "dashboard.today" : "dashboard.yesterday")}
          <b>{"฿" + formatMoney(Number(entry.value ?? 0))}</b>
        </span>
      ))}
    </div>
  );
}

export function DashboardSalesChart({
  dashboard,
  formatMoney,
  formatNumber,
  t,
}: {
  dashboard: DashboardResponse;
  formatMoney: (value: number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: Translate;
}) {
  const firstHour = dashboard.hourlySales.at(0)?.hour ?? "08:00";
  const lastHour = dashboard.hourlySales.at(-1)?.hour ?? "20:00";
  const chartWidth = Math.max(760, dashboard.hourlySales.length * 74);
  const yAxis = buildSalesYAxis();
  const financials = dashboard.ownerFinancials;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hasCompleteCost = Boolean(financials
    && financials.pricedLines === financials.totalLines);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      if (scrollTimelineWithWheel(scroller, event)) event.preventDefault();
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.currentTarget.scrollBy({
      left: event.key === "ArrowLeft" ? -180 : 180,
      behavior: "smooth",
    });
  };

  return (
    <section
      className={`${styles.panel} ${styles.salesChartPanel}`}
      aria-labelledby="dashboard-sales-title"
    >
      <header className={styles.panelHeader}>
        <div>
          <h2 id="dashboard-sales-title">{t("dashboard.salesToday")}</h2>
          <p>{t("dashboard.hourlyComparison")}</p>
        </div>
        <div className={styles.legend} aria-label={t("dashboard.chartLegend")}>
          <span><i className={styles.legendToday} />{t("dashboard.today")}</span>
          <span><i className={styles.legendYesterday} />{t("dashboard.yesterday")}</span>
        </div>
      </header>

      {financials && (
        <div className={styles.financialStrip}>
          <div>
            <span>{t("dashboard.grossDifference")}</span>
            <strong>{financials.grossDifference === null
              ? t("dashboard.costUnavailable")
              : "฿" + formatMoney(financials.grossDifference)}</strong>
          </div>
          <div>
            <span>{t("dashboard.margin")}</span>
            <strong>{financials.marginPercent === null
              ? "—"
              : formatNumber(financials.marginPercent, { maximumFractionDigits: 2 }) + "%"}</strong>
          </div>
          {!hasCompleteCost && (
            <p>
              <CircleAlert size={13} aria-hidden="true" />
              {t("dashboard.costCoverage", {
                priced: financials.pricedLines,
                total: financials.totalLines,
              })}
            </p>
          )}
        </div>
      )}

      <div
        ref={scrollerRef}
        className={styles.chartScroller}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="region"
        aria-label={t("dashboard.chartScrollLabel", { from: firstHour, to: lastHour })}
      >
        <div className={styles.chartCanvas} style={{ width: chartWidth }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dashboard.hourlySales} margin={{ top: 14, right: 24, left: 0, bottom: 2 }}>
              <CartesianGrid stroke="var(--app-border-soft)" vertical={false} />
              <XAxis
                dataKey="hour"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--app-muted)" }}
                interval={0}
                padding={{ left: 20, right: 8 }}
              />
              <YAxis
                axisLine={false}
                allowDataOverflow
                tickLine={false}
                domain={yAxis.domain}
                ticks={yAxis.ticks}
                tick={{ fontSize: 10, fill: "var(--app-muted)" }}
                width={54}
                tickFormatter={(value) => "฿" + formatNumber(Number(value), {
                  maximumFractionDigits: 0,
                })}
              />
              <Tooltip content={<SalesTooltip formatMoney={formatMoney} t={t} />} />
              <Area
                type="monotone"
                dataKey="yesterday"
                stroke="color-mix(in srgb, var(--app-muted) 56%, transparent)"
                strokeWidth={1.5}
                fill="transparent"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="today"
                stroke="var(--app-accent)"
                strokeWidth={2.25}
                fill="var(--app-accent-soft)"
                fillOpacity={0.72}
                dot={false}
                activeDot={{ r: 4, fill: "var(--app-accent)", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className={styles.scrollHint}>
        <ArrowLeftRight size={13} aria-hidden="true" />
        {t("dashboard.scrollHint", { from: firstHour, to: lastHour })}
      </p>
    </section>
  );
}
