import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, DollarSign, ShoppingBag, Users, AlertCircle,
  Clock, Star, Activity, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

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
  { name: "Prescription", margin: 38, revenue: 29500 },
  { name: "OTC Drugs", margin: 27, revenue: 21800 },
  { name: "Supplements", margin: 20, revenue: 12700 },
  { name: "Med. Devices", margin: 15, revenue: 8400 },
];

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
  { name: "Pharmacist", active: 3, total: 3 },
  { name: "Assistant", active: 5, total: 6 },
  { name: "Cashier", active: 2, total: 2 },
  { name: "Delivery", active: 2, total: 3 },
];

const staffBarData = [
  { name: "Nopporn A.", role: "Pharmacist", txn: 48, sales: 18400 },
  { name: "Malee T.", role: "Pharmacist", txn: 41, sales: 15200 },
  { name: "Kasorn W.", role: "Assistant", txn: 36, sales: 11700 },
  { name: "Duangjai P.", role: "Cashier", txn: 62, sales: 9800 },
  { name: "Somchai R.", role: "Assistant", txn: 29, sales: 8400 },
];

const badgeColors: Record<string, { bg: string; text: string }> = {
  Gold:   { bg: "#fef3c7", text: "#92400e" },
  Silver: { bg: "#f1f5f9", text: "#475569" },
  Bronze: { bg: "#fdf2ec", text: "#7c3a1a" },
};

const kpiCards = [
  { icon: DollarSign, label: "Today's Sales", value: "฿72,400", sub: "438 transactions", trend: "+12.4%", up: true, accent: "#2e7d52", accentBg: "#e6f4ec" },
  { icon: TrendingUp,  label: "Gross Margin",  value: "31.2%",   sub: "vs 28.8% yesterday", trend: "+2.4pp", up: true, accent: "#2563b0", accentBg: "#e8f0fa" },
  { icon: ShoppingBag, label: "Avg. Basket",   value: "฿165",    sub: "per transaction",    trend: "-3.1%",  up: false, accent: "#b5531e", accentBg: "#faeee6" },
  { icon: Users,       label: "Members Today", value: "142",      sub: "of 438 transactions", trend: "+8.7%", up: true, accent: "#6347b5", accentBg: "#eeebf8" },
];

const CustomSalesTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e2d24", border: "1px solid #2d4035", borderRadius: 4, padding: "8px 12px" }}>
      <p style={{ fontSize: "11px", color: "#9cb8a4", marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ fontSize: "12px", color: p.dataKey === "sales" ? "#a3c9b0" : "#64748b" }}>
          {p.dataKey === "sales" ? "Today" : "Yesterday"}: ฿{p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const CustomMarginTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e2d24", border: "1px solid #2d4035", borderRadius: 4, padding: "8px 12px" }}>
      <p style={{ fontSize: "11px", color: "#9cb8a4", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: "12px", color: "#a3c9b0" }}>Margin: {payload[0]?.value}%</p>
    </div>
  );
};

export function Dashboard() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "#f4f6f5" }}>
      <div className="p-5 w-full min-h-full" style={{ boxSizing: "border-box" }}>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 style={{ color: "#101c14", fontSize: "18px", fontWeight: 700 }}>Dashboard Overview</h1>
            <p style={{ fontSize: "12px", color: "#64748b", marginTop: 2 }}>
              Friday, June 26, 2026 &nbsp;·&nbsp; Branch: Main Store
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 border"
              style={{ background: "#fff", borderColor: "#dde5e0", borderRadius: 4 }}>
              <div className="w-2 h-2 rounded-full" style={{ background: "#3d9664" }} />
              <span style={{ fontSize: "12px", color: "#2e7d52" }}>Store Open</span>
            </div>
            <div className="px-3 py-1.5 border" style={{ background: "#fff", borderColor: "#dde5e0", borderRadius: 4 }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>Shift: 08:00 – 20:00</span>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div
          className="grid gap-3 mb-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))" }}
        >
          {kpiCards.map(({ icon: Icon, label, value, sub, trend, up, accent, accentBg }) => (
            <div key={label} className="p-4 border" style={{ background: "#fff", borderColor: "#dde5e0", borderRadius: 6 }}>
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
              <p style={{ fontSize: "11px", color: "#64748b", marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: "22px", fontWeight: 700, color: "#101c14", lineHeight: 1.2 }}>{value}</p>
              <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: 2 }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Sales Chart + Margin */}
        <div
          className="grid gap-4 mb-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))" }}
        >

          {/* Sales Area Chart */}
          <div className="p-5 border" style={{ background: "#fff", borderColor: "#dde5e0", borderRadius: 6 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 style={{ color: "#101c14", fontSize: "14px", fontWeight: 600 }}>Sales Today</h3>
                <p style={{ fontSize: "11px", color: "#94a3b8" }}>Hourly revenue comparison</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-0.5" style={{ background: "#3d9664" }} />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Today</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-0.5" style={{ background: "#c8d5cc" }} />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Yesterday</span>
                </div>
              </div>
            </div>
            <div style={{ width: "100%", height: "clamp(190px, 24vh, 280px)" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3a9e68" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#3a9e68" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `฿${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomSalesTooltip />} />
                  <Area type="monotone" dataKey="yesterday" stroke="#c8d5cc" strokeWidth={1.5} fill="none" dot={false} />
                  <Area type="monotone" dataKey="sales" stroke="#3a9e68" strokeWidth={2}
                    fill="url(#salesGrad)" dot={false}
                    activeDot={{ r: 4, fill: "#3a9e68", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Margin — Horizontal Bar Chart */}
          <div className="p-5 border" style={{ background: "#fff", borderColor: "#dde5e0", borderRadius: 6 }}>
            <div className="mb-4">
              <h3 style={{ color: "#101c14", fontSize: "14px", fontWeight: 600 }}>Margin by Category</h3>
              <p style={{ fontSize: "11px", color: "#94a3b8" }}>Gross margin % per segment</p>
            </div>
            <div style={{ width: "100%", height: "clamp(150px, 20vh, 220px)" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marginData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`} domain={[0, 50]} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomMarginTooltip />} />
                  <Bar dataKey="margin" fill="#3a9e68" radius={[0, 2, 2, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid #eef1ef" }}>
              <div className="flex justify-between">
                <span style={{ fontSize: "11px", color: "#64748b" }}>Avg. blended margin</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#101c14" }}>31.2%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row: Top Members + Payables + Staff */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}
        >

          {/* Top Member Purchase */}
          <div className="p-5 border" style={{ background: "#fff", borderColor: "#dde5e0", borderRadius: 6 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 style={{ color: "#101c14", fontSize: "14px", fontWeight: 600 }}>Top Member Purchase</h3>
                <p style={{ fontSize: "11px", color: "#94a3b8" }}>This month</p>
              </div>
              <Star size={13} style={{ color: "#c9910e" }} />
            </div>
            <div className="space-y-3">
              {topMembers.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", width: 14, textAlign: "center" }}>
                    {m.rank}
                  </span>
                  <div className="w-8 h-8 flex items-center justify-center text-xs shrink-0"
                    style={{ background: "#e6f4ec", color: "#2e7d52", fontWeight: 700, borderRadius: 4 }}>
                    {m.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "#101c14" }}>{m.name}</p>
                    <p style={{ fontSize: "10px", color: "#94a3b8" }}>{m.id} · {m.visits} visits</p>
                  </div>
                  <div className="text-right">
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#101c14" }}>฿{m.amount.toLocaleString()}</p>
                    <span className="px-1.5 py-0.5 text-xs"
                      style={{
                        background: badgeColors[m.badge].bg,
                        color: badgeColors[m.badge].text,
                        fontWeight: 600,
                        fontSize: "10px",
                        borderRadius: 3,
                      }}>
                      {m.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Need to Pay */}
          <div className="p-5 border" style={{ background: "#fff", borderColor: "#dde5e0", borderRadius: 6 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 style={{ color: "#101c14", fontSize: "14px", fontWeight: 600 }}>Need to Pay</h3>
                <p style={{ fontSize: "11px", color: "#94a3b8" }}>Outstanding payables</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5"
                style={{ background: "#fdf0ee", borderRadius: 3 }}>
                <AlertCircle size={10} style={{ color: "#c0472e" }} />
                <span style={{ fontSize: "10px", color: "#c0472e", fontWeight: 600 }}>1 overdue</span>
              </div>
            </div>

            <div className="p-3 mb-4" style={{ background: "#f7f9f8", borderRadius: 4, border: "1px solid #e4eae6" }}>
              <p style={{ fontSize: "11px", color: "#64748b" }}>Total Outstanding</p>
              <p style={{ fontSize: "20px", fontWeight: 700, color: "#101c14" }}>
                ฿{(45200 + 23800 + 67500 + 31200 + 19700).toLocaleString()}
              </p>
              <p style={{ fontSize: "10px", color: "#94a3b8" }}>5 invoices · 5 suppliers</p>
            </div>

            <div className="space-y-3">
              {payables.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.overdue
                      ? <AlertCircle size={12} style={{ color: "#c0472e" }} />
                      : <Clock size={12} style={{ color: "#94a3b8" }} />}
                    <div>
                      <p style={{ fontSize: "12px", fontWeight: 500, color: "#101c14" }}>{p.supplier}</p>
                      <p style={{ fontSize: "10px", color: p.overdue ? "#c0472e" : "#94a3b8" }}>
                        Due {p.due}{p.overdue ? " — OVERDUE" : ""}
                      </p>
                    </div>
                  </div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: p.overdue ? "#c0472e" : "#101c14" }}>
                    ฿{p.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Staff Overview */}
          <div className="p-5 border" style={{ background: "#fff", borderColor: "#dde5e0", borderRadius: 6 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 style={{ color: "#101c14", fontSize: "14px", fontWeight: 600 }}>Staff Overview</h3>
                <p style={{ fontSize: "11px", color: "#94a3b8" }}>Today's performance</p>
              </div>
              <Activity size={13} style={{ color: "#64748b" }} />
            </div>

            {/* Status grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {staffData.map((s, i) => {
                const colors = ["#3d9664", "#2563b0", "#b5531e", "#6347b5"];
                const bgs = ["#e6f4ec", "#e8f0fa", "#faeee6", "#eeebf8"];
                return (
                  <div key={s.name} className="p-2.5 border" style={{ borderColor: "#e4eae6", borderRadius: 4 }}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span style={{ fontSize: "10px", color: "#64748b" }}>{s.name}</span>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: colors[i] }}>
                        {s.active}/{s.total}
                      </span>
                    </div>
                    <div className="h-1" style={{ background: "#eef1ef", borderRadius: 2 }}>
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

            <p style={{ fontSize: "11px", color: "#64748b", marginBottom: 8 }}>Performance by staff</p>
            <div className="space-y-2.5">
              {staffBarData.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 flex items-center justify-center text-xs shrink-0"
                    style={{ background: "#e6f4ec", color: "#2e7d52", fontWeight: 700, borderRadius: 4 }}>
                    {s.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span style={{ fontSize: "11px", fontWeight: 500, color: "#101c14" }}>{s.name}</span>
                      <span style={{ fontSize: "10px", color: "#64748b" }}>{s.txn} txn</span>
                    </div>
                    <div className="h-1" style={{ background: "#f0f2f1", borderRadius: 2 }}>
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
