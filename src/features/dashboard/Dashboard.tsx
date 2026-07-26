import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, DollarSign, ShoppingBag, Users, AlertCircle,
  Clock, Star, Activity, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { TranslationKey } from "@/i18n/i18n";
import styles from "./Dashboard.module.css";

const salesData = [
  { time: "08:00", sales: 1200, yesterday: 900 },
  { time: "09:00", sales: 2800, yesterday: 2100 },
  { time: "10:00", sales: 3500, yesterday: 2900 },
  { time: "11:00", sales: 4100, yesterday: 3600 },
  { time: "12:00", sales: 3800, yesterday: 3200 },
  { time: "13:00", sales: 5200, yesterday: 4100 },
  { time: "14:00", sales: 6100, yesterday: 4800 },
  { time: "15:00", sales: 5800, yesterday: 5100 },
  { time: "16:00", sales: 7200, yesterday: 5900 },
  { time: "17:00", sales: 6900, yesterday: 6200 },
];

const marginData = [
  { nameKey: "dashboard.prescription", margin: 38, revenue: 29500 },
  { nameKey: "dashboard.otc", margin: 27, revenue: 21800 },
  { nameKey: "dashboard.supplements", margin: 20, revenue: 12700 },
  { nameKey: "dashboard.devices", margin: 15, revenue: 8400 },
] satisfies Array<{ nameKey: TranslationKey; margin: number; revenue: number }>;

const topMembers = [
  { rank: 1, name: "Siriporn K.", id: "M-0042", amount: 28500, visits: 12, badge: "Gold" },
  { rank: 2, name: "Thanawat P.", id: "M-0018", amount: 22100, visits: 9, badge: "Gold" },
  { rank: 3, name: "Wanida S.", id: "M-0031", amount: 18750, visits: 15, badge: "Silver" },
  { rank: 4, name: "Arthit N.", id: "M-0067", amount: 15400, visits: 7, badge: "Silver" },
  { rank: 5, name: "Parichat L.", id: "M-0055", amount: 12300, visits: 11, badge: "Bronze" },
];

const payables = [
  { supplier: "PharmaCo Ltd.", due: "Today", amount: 45200, overdue: true },
  { supplier: "MediSupply Co.", due: "Jun 28", amount: 23800, overdue: false },
  { supplier: "HealthDist Inc.", due: "Jun 30", amount: 67500, overdue: false },
  { supplier: "BioPharm Group", due: "Jul 2", amount: 31200, overdue: false },
  { supplier: "GenericMeds Ltd.", due: "Jul 5", amount: 19700, overdue: false },
];

const staffData = [
  { nameKey: "common.pharmacist", active: 3, total: 3 },
  { nameKey: "dashboard.assistant", active: 5, total: 6 },
  { nameKey: "dashboard.cashier", active: 2, total: 2 },
  { nameKey: "dashboard.delivery", active: 2, total: 3 },
] satisfies Array<{ nameKey: TranslationKey; active: number; total: number }>;

const staffBarData = [
  { name: "Nopporn A.", role: "Pharmacist", txn: 48, sales: 18400 },
  { name: "Malee T.", role: "Pharmacist", txn: 41, sales: 15200 },
  { name: "Kasorn W.", role: "Assistant", txn: 36, sales: 11700 },
  { name: "Duangjai P.", role: "Cashier", txn: 62, sales: 9800 },
  { name: "Somchai R.", role: "Assistant", txn: 29, sales: 8400 },
];

const badgeColors: Record<string, { bg: string; text: string }> = {
  Gold:   { bg: "#fef3c7", text: "#92400e" },
  Silver: { bg: "#f1f5f9", text: "var(--app-muted)" },
  Bronze: { bg: "#fdf2ec", text: "#7c3a1a" },
};

const kpiCards = [
  { icon: DollarSign, labelKey: "dashboard.todaySales", value: "฿72,400", subKey: "dashboard.transactions", subCount: 438, trend: "+12.4%", up: true, accent: "#2e7d52", accentBg: "#e6f4ec" },
  { icon: TrendingUp, labelKey: "dashboard.grossMargin", value: "31.2%", subKey: "dashboard.vsYesterday", trend: "+2.4pp", up: true, accent: "#2563b0", accentBg: "#e8f0fa" },
  { icon: ShoppingBag, labelKey: "dashboard.avgBasket", value: "฿165", subKey: "dashboard.perTransaction", trend: "-3.1%", up: false, accent: "#b5531e", accentBg: "#faeee6" },
  { icon: Users, labelKey: "dashboard.membersToday", value: "142", subKey: "dashboard.ofTransactions", subCount: 438, trend: "+8.7%", up: true, accent: "#6347b5", accentBg: "#eeebf8" },
];

const CustomSalesTooltip = ({ active, payload, label, t }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className={styles.tooltipLine} style={{ color: p.dataKey === "sales" ? "#a3c9b0" : "var(--app-muted)" }}>
          {p.dataKey === "sales" ? t("dashboard.today") : t("dashboard.yesterday")}: ฿{p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const CustomMarginTooltip = ({ active, payload, label, t }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      <p className={styles.tooltipLine} style={{ color: "#a3c9b0" }}>{t("dashboard.grossMargin")}: {payload[0]?.value}%</p>
    </div>
  );
};

export function Dashboard() {
  const { t, formatDate, formatNumber } = usePreferences();
  const localizedMarginData = marginData.map((item) => ({ ...item, name: t(item.nameKey) }));
  const localizedStaffData = staffData.map((item) => ({ ...item, name: t(item.nameKey) }));
  const badgeLabel = (badge: string) => t(badge === "Gold"
    ? "dashboard.gold"
    : badge === "Silver" ? "dashboard.silver" : "dashboard.bronze");
  return (
    <div className={styles.page}>
      <div className={styles.content}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>{t("dashboard.overview")}</h1>
            <p className={styles.pageSubtitle}>
              {formatDate("2026-06-26", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} &nbsp;·&nbsp; {t("dashboard.branch")}
            </p>
          </div>
          <div className={styles.statusGroup}>
            <div className={styles.statusPill}>
              <div className={styles.statusDot} />
              <span className={styles.statusText}>{t("dashboard.storeOpen")}</span>
            </div>
            <div className={styles.shiftPill}>
              <span className={styles.mutedText}>{t("dashboard.shift")}</span>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className={styles.kpiGrid}>
          {kpiCards.map(({ icon: Icon, labelKey, value, subKey, subCount, trend, up, accent, accentBg }) => (
            <div key={labelKey} className={styles.kpiCard}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 flex items-center justify-center" style={{ background: accentBg, borderRadius: 4 }}>
                  <Icon size={16} style={{ color: accent }} />
                </div>
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs"
                  style={{
                    background: up ? "#e6f4ec" : "#fdf0ee",
                    color: up ? "#2e7d52" : "#c0472e",
                    borderRadius: 3,
                  }}>
                  {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {trend}
                </span>
              </div>
              <p style={{ fontSize: "11px", color: "var(--app-muted)", marginBottom: 2 }}>{t(labelKey as TranslationKey)}</p>
              <p style={{ fontSize: "22px", fontWeight: 700, color: "var(--app-ink)", lineHeight: 1.2 }}>{value}</p>
              <p style={{ fontSize: "11px", color: "var(--app-muted)", marginTop: 2 }}>{t(subKey as TranslationKey, subCount ? { count: subCount } : undefined)}</p>
            </div>
          ))}
        </div>

        {/* Sales Chart + Margin */}
        <div className={styles.splitGrid}>

          {/* Sales Area Chart */}
          <div className={styles.paddedCard}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>{t("dashboard.salesToday")}</h3>
                <p className={styles.cardSubtitle}>{t("dashboard.hourlyComparison")}</p>
              </div>
              <div className={styles.legend}>
                <div className={styles.legendItem}>
                  <div className={styles.legendLineToday} />
                  <span className={styles.legendText}>{t("dashboard.today")}</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.legendLineYesterday} />
                  <span className={styles.legendText}>{t("dashboard.yesterday")}</span>
                </div>
              </div>
            </div>
            <div className={styles.chartBoxTall}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border-soft)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--app-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--app-muted)" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `฿${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomSalesTooltip t={t} />} />
                  <Area type="monotone" dataKey="yesterday" stroke="#c8d5cc" strokeWidth={1.5} fill="none" dot={false} />
                  <Area type="monotone" dataKey="sales" stroke="#3a9e68" strokeWidth={2}
                    fill="#e5f1ea" fillOpacity={0.65} dot={false}
                    activeDot={{ r: 4, fill: "#3a9e68", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Margin — Horizontal Bar Chart */}
          <div className={styles.paddedCard}>
            <div className="mb-4">
              <h3 className={styles.cardTitle}>{t("dashboard.marginCategory")}</h3>
              <p className={styles.cardSubtitle}>{t("dashboard.marginSegment")}</p>
            </div>
            <div className={styles.chartBoxShort}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={localizedMarginData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border-soft)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--app-muted)" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`} domain={[0, 50]} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--app-muted)" }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomMarginTooltip t={t} />} />
                  <Bar dataKey="margin" fill="#3a9e68" radius={[0, 2, 2, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.sectionDivider}>
              <div className="flex justify-between">
                <span style={{ fontSize: "11px", color: "var(--app-muted)" }}>{t("dashboard.avgMargin")}</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--app-ink)" }}>31.2%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row: Top Members + Payables + Staff */}
        <div className={styles.bottomGrid}>

          {/* Top Member Purchase */}
          <div className={styles.paddedCard}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>{t("dashboard.topMembers")}</h3>
                <p className={styles.cardSubtitle}>{t("dashboard.thisMonth")}</p>
              </div>
              <Star size={13} style={{ color: "#c9910e" }} />
            </div>
            <div className="space-y-3">
              {topMembers.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--app-muted)", width: 14, textAlign: "center" }}>
                    {m.rank}
                  </span>
                  <div className="w-8 h-8 flex items-center justify-center text-xs shrink-0"
                    style={{ background: "#e6f4ec", color: "#2e7d52", fontWeight: 700, borderRadius: 4 }}>
                    {m.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--app-ink)" }}>{m.name}</p>
                    <p style={{ fontSize: "10px", color: "var(--app-muted)" }}>{m.id} · {t("dashboard.visits", { count: m.visits })}</p>
                  </div>
                  <div className="text-right">
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--app-ink)" }}>฿{m.amount.toLocaleString()}</p>
                    <span className="px-1.5 py-0.5 text-xs"
                      style={{
                        background: badgeColors[m.badge].bg,
                        color: badgeColors[m.badge].text,
                        fontWeight: 600,
                        fontSize: "10px",
                        borderRadius: 3,
                      }}>
                      {badgeLabel(m.badge)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Need to Pay */}
          <div className={styles.paddedCard}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>{t("dashboard.needPay")}</h3>
                <p className={styles.cardSubtitle}>{t("dashboard.outstandingPayables")}</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5"
                style={{ background: "#fdf0ee", borderRadius: 3 }}>
                <AlertCircle size={10} style={{ color: "#c0472e" }} />
                <span style={{ fontSize: "10px", color: "#c0472e", fontWeight: 600 }}>{t("dashboard.overdueCount", { count: 1 })}</span>
              </div>
            </div>

            <div className="p-3 mb-4" style={{ background: "var(--app-surface-muted)", borderRadius: 4, border: "1px solid var(--app-border)" }}>
              <p style={{ fontSize: "11px", color: "var(--app-muted)" }}>{t("dashboard.totalOutstanding")}</p>
              <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--app-ink)" }}>
                ฿{(45200 + 23800 + 67500 + 31200 + 19700).toLocaleString()}
              </p>
              <p style={{ fontSize: "10px", color: "var(--app-muted)" }}>{t("dashboard.invoiceSupplierCount", { invoices: 5, suppliers: 5 })}</p>
            </div>

            <div className="space-y-3">
              {payables.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.overdue
                      ? <AlertCircle size={12} style={{ color: "#c0472e" }} />
                      : <Clock size={12} style={{ color: "var(--app-muted)" }} />}
                    <div>
                      <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--app-ink)" }}>{p.supplier}</p>
                      <p style={{ fontSize: "10px", color: p.overdue ? "#c0472e" : "var(--app-muted)" }}>
                        {t("dashboard.due", { date: p.due === "Today" ? t("dashboard.today") : p.due })}{p.overdue ? ` — ${t("dashboard.overdue")}` : ""}
                      </p>
                    </div>
                  </div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: p.overdue ? "#c0472e" : "var(--app-ink)" }}>
                    ฿{p.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Staff Overview */}
          <div className={styles.paddedCard}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>{t("dashboard.staffOverview")}</h3>
                <p className={styles.cardSubtitle}>{t("dashboard.todayPerformance")}</p>
              </div>
              <Activity size={13} style={{ color: "var(--app-muted)" }} />
            </div>

            {/* Status grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {localizedStaffData.map((s, i) => {
                const colors = ["#3d9664", "#2563b0", "#b5531e", "#6347b5"];
                const bgs = ["#e6f4ec", "#e8f0fa", "#faeee6", "#eeebf8"];
                return (
                  <div key={s.name} className="p-2.5 border" style={{ borderColor: "var(--app-border)", borderRadius: 4 }}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span style={{ fontSize: "10px", color: "var(--app-muted)" }}>{s.name}</span>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: colors[i] }}>
                        {s.active}/{s.total}
                      </span>
                    </div>
                    <div className="h-1" style={{ background: "var(--app-border-soft)", borderRadius: 2 }}>
                      <div className="h-1" style={{
                        background: colors[i],
                        width: `${(s.active / s.total) * 100}%`,
                        borderRadius: 2,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: "11px", color: "var(--app-muted)", marginBottom: 8 }}>{t("dashboard.performanceByStaff")}</p>
            <div className="space-y-2.5">
              {staffBarData.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 flex items-center justify-center text-xs shrink-0"
                    style={{ background: "#e6f4ec", color: "#2e7d52", fontWeight: 700, borderRadius: 4 }}>
                    {s.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--app-ink)" }}>{s.name}</span>
                      <span style={{ fontSize: "10px", color: "var(--app-muted)" }}>{t("dashboard.txn", { count: formatNumber(s.txn) })}</span>
                    </div>
                    <div className="h-1" style={{ background: "var(--app-border-soft)", borderRadius: 2 }}>
                      <div className="h-1" style={{ background: "#3d9664", width: `${(s.txn / 70) * 100}%`, borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
