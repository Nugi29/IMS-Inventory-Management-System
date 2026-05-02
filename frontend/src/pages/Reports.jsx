import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { useReports } from "../services/useReports";

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  emerald: "#10b981",
  teal: "#14b8a6",
  sky: "#0ea5e9",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  slate900: "#0f172a",
  slate800: "#1e293b",
  slate700: "#334155",
  slate600: "#475569",
  slate400: "#94a3b8",
};
const PIE_COLORS = [C.emerald, C.sky, C.amber, C.violet, C.rose, C.teal, "#f97316", "#a78bfa"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1_000_000
    ? `Rs. ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `Rs. ${(n / 1_000).toFixed(1)}K`
    : `Rs. ${n?.toLocaleString() ?? 0}`;

const fmtNum = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n ?? 0);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// ─── Shared UI ────────────────────────────────────────────────────────────────
const Loader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
      <div className="absolute inset-2 rounded-full border-2 border-teal-400/20 border-b-teal-400 animate-spin" style={{ animationDirection: "reverse" }} />
    </div>
  </div>
);

const SectionTitle = ({ children, sub }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-slate-100 tracking-tight">{children}</h2>
    {sub && <p className="text-sm text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

const Card = ({ children, className }) => (
  <div className={`bg-slate-800 bg-opacity-60 border border-slate-700 border-opacity-50 rounded-2xl ${className || ""}`}>
    {children}
  </div>
);

const KpiCard = ({ label, value, sub, icon, color }) => {
  const gradients = {
    emerald: "border-emerald-500 border-opacity-20 text-emerald-400",
    rose: "border-rose-500 border-opacity-20 text-rose-400",
    sky: "border-sky-500 border-opacity-20 text-sky-400",
    amber: "border-amber-500 border-opacity-20 text-amber-400",
    violet: "border-violet-500 border-opacity-20 text-violet-400",
    teal: "border-teal-500 border-opacity-20 text-teal-400",
  };
  return (
    <div className={`border rounded-2xl p-5 flex flex-col gap-3 bg-slate-800 bg-opacity-40 ${gradients[color || "emerald"]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        <span className="text-2xl opacity-80">{icon}</span>
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-100 leading-tight">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
};

const Badge = ({ label, variant }) => {
  const v = {
    default: "bg-slate-700 text-slate-300",
    success: "bg-emerald-900 bg-opacity-60 text-emerald-300 border border-emerald-700",
    warning: "bg-amber-900 bg-opacity-60 text-amber-300 border border-amber-700",
    danger: "bg-rose-900 bg-opacity-60 text-rose-300 border border-rose-700",
    info: "bg-sky-900 bg-opacity-60 text-sky-300 border border-sky-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${v[variant || "default"]}`}>
      {label}
    </span>
  );
};

const DataTable = ({ headers, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-700">
          {headers.map((h, i) => (
            <th key={i} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-slate-700 border-opacity-40 hover:bg-slate-700 hover:bg-opacity-20 transition-colors">
            {row.map((cell, j) => (
              <td key={j} className="py-3 px-4 text-slate-300">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TipTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-slate-100 font-semibold">Rs. {p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const StockBar = ({ pct, isOut }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full ${isOut ? "bg-rose-500" : pct < 30 ? "bg-amber-500" : "bg-emerald-500"}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
    <span className={`text-xs font-medium w-8 text-right ${isOut ? "text-rose-400" : pct < 30 ? "text-amber-400" : "text-emerald-400"}`}>
      {pct}%
    </span>
  </div>
);

const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "sales", label: "Sales", icon: "💰" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "purchases", label: "Purchases", icon: "🚚" },
  { id: "suppliers", label: "Suppliers", icon: "🏭" },
  { id: "profit", label: "Profit", icon: "📈" },
];

// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════════════════
function OverviewTab({ api }) {
  const [summary, setSummary] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, d] = await Promise.all([api.getSummary(), api.getDashboard()]);
      setSummary(s?.summary);
      setDashboard(d?.dashboardData);
      setLoading(false);
    })();
  }, [api]);

  if (loading) return <Loader />;
  if (!summary || !dashboard) return <p className="text-slate-400 text-center py-12">Could not load overview data.</p>;

  const { salesTrend = [], recentSales = [], lowStockItems = [], purchaseActivity = [], liveFeed = [] } = dashboard;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Sales" value={fmt(summary.totalSales)} icon="💵" color="emerald" />
        <KpiCard label="Total Purchases" value={fmt(summary.totalPurchases)} icon="🛒" color="sky" />
        <KpiCard label="Profit / Loss" value={fmt(summary.totalProfit)} icon={summary.totalProfit >= 0 ? "📈" : "📉"} color={summary.totalProfit >= 0 ? "emerald" : "rose"} sub={summary.totalProfit < 0 ? "Net deficit period" : "Healthy"} />
        <KpiCard label="Stock Value" value={fmt(summary.totalStockValue)} icon="🏪" color="teal" />
        <KpiCard label="Total Orders" value={fmtNum(summary.totalOrders)} icon="🧾" color="violet" />
        <KpiCard label="Suppliers" value={summary.totalSuppliers} icon="🏭" color="amber" />
        <KpiCard label="Low Stock Items" value={summary.lowStock} icon="⚠️" color="rose" sub="Need reorder" />
        <KpiCard label="Today Sales" value={fmt(dashboard.summary.total_sales_today)} icon="☀️" color="amber" sub={`${dashboard.summary.total_sales_count_today} transactions`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <SectionTitle sub="7-day revenue trend">Sales Trend</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="emeraldG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.emerald} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate700} />
              <XAxis dataKey="label" tick={{ fill: C.slate400, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fill: C.slate400, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<TipTooltip />} />
              <Area type="monotone" dataKey="amount" name="Revenue" stroke={C.emerald} strokeWidth={2.5} fill="url(#emeraldG)" dot={{ fill: C.emerald, r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <SectionTitle sub="Latest activity">Live Feed</SectionTitle>
          <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 240 }}>
            {liveFeed.map((f) => (
              <div key={f.id} className="flex gap-3 items-start">
                <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${f.movement_type === "SALE" ? "bg-emerald-900 bg-opacity-60 text-emerald-400" : "bg-sky-900 bg-opacity-60 text-sky-400"}`}>
                  {f.movement_type === "SALE" ? "S" : "G"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{f.title}</p>
                  <p className="text-xs text-slate-500">{f.description} · {f.actor} · {fmtDate(f.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <SectionTitle sub="Latest invoices">Recent Sales</SectionTitle>
          <DataTable
            headers={["Invoice", "Date", "Items", "Amount"]}
            rows={recentSales.map((s) => [
              <span className="font-mono text-emerald-400 text-xs">{s.invoice_no}</span>,
              fmtDate(s.sale_date),
              s.item_count,
              <span className="font-semibold">{fmt(s.total_amount)}</span>,
            ])}
          />
        </Card>
        <Card className="p-6">
          <SectionTitle sub="Below reorder threshold">Low Stock Alert</SectionTitle>
          <div className="space-y-4">
            {lowStockItems.map((item) => (
              <div key={item.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-300 font-medium truncate" style={{ maxWidth: "60%" }}>{item.item_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{item.quantity}/{item.reorder_level}</span>
                    {item.is_out_of_stock ? <Badge label="Out" variant="danger" /> : <Badge label="Low" variant="warning" />}
                  </div>
                </div>
                <StockBar pct={item.level_percent} isOut={item.is_out_of_stock} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <SectionTitle sub="Recent goods received">Purchase Activity</SectionTitle>
        <DataTable
          headers={["GRN No", "Supplier", "Items", "Amount", "Status", "Date"]}
          rows={purchaseActivity.map((p) => [
            <span className="font-mono text-sky-400 text-xs">{p.grn_no}</span>,
            p.supplier_name,
            p.items_received,
            fmt(p.total_amount),
            <Badge label={p.status_name} variant={p.status_name === "Fully Received" ? "success" : "warning"} />,
            fmtDate(p.grn_date),
          ])}
        />
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SALES TAB
// ══════════════════════════════════════════════════════════════════════════════
function SalesTab({ api }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [daily, monthly, byItem, byCashier, topItems] = await Promise.all([
        api.getSalesDaily(), api.getSalesMonthly(), api.getSalesByItem(),
        api.getSalesByCashier(), api.getTopSellingItems(),
      ]);
      setData({
        daily: daily?.daily || [],
        monthly: monthly?.monthly || [],
        byItem: byItem?.byItem || [],
        byCashier: byCashier?.byCashier || [],
        topItems: topItems?.topItems || [],
      });
      setLoading(false);
    })();
  }, [api]);

  if (loading) return <Loader />;
  const { daily, monthly, byItem, byCashier, topItems } = data;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {monthly.slice(0, 1).map((m) => (
          <KpiCard key={m.month} label={`Month ${m.month}`} value={fmt(m.total_amount)} icon="📅" color="sky" sub={`${m.count} transactions`} />
        ))}
        <KpiCard label="Top Item Revenue" value={fmt(byItem[0]?.revenue)} icon="🏆" color="emerald" sub={byItem[0]?.item_name?.split(" ").slice(0, 2).join(" ")} />
        <KpiCard label="Unique SKUs Sold" value={fmtNum(byItem.length)} icon="🔢" color="violet" />
        <KpiCard label="Top Cashier" value={byCashier[0]?.cashier ?? "—"} icon="👤" color="teal" sub={fmt(byCashier[0]?.total_amount)} />
      </div>

      <Card className="p-6">
        <SectionTitle sub="Revenue by day">Daily Sales</SectionTitle>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={daily.map((d) => ({ ...d, date: fmtDate(d.date) }))} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.slate700} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: C.slate400, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fill: C.slate400, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<TipTooltip />} />
            <Bar dataKey="total_amount" name="Revenue" fill={C.emerald} radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <SectionTitle sub="Best performing products">Top Selling Items</SectionTitle>
          <div className="space-y-3">
            {topItems.slice(0, 8).map((item, i) => (
              <div key={item.item_id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-slate-300 truncate">{item.item_name}</span>
                    <span className="text-xs text-slate-400 ml-2 shrink-0">{fmtNum(item.quantity)} units</span>
                  </div>
                  <div className="bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((item.revenue / topItems[0].revenue) * 100, 100)}%` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-emerald-400 shrink-0 w-20 text-right">{fmt(item.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle sub="Revenue split by cashier">Sales by Cashier</SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byCashier} dataKey="total_amount" nameKey="cashier" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3}>
                {byCashier.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-slate-300 text-xs">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6">
        <SectionTitle sub="Revenue breakdown per product">Sales by Item</SectionTitle>
        <DataTable
          headers={["Item Name", "Qty Sold", "Revenue"]}
          rows={byItem.slice(0, 15).map((r) => [
            r.item_name,
            <span className="font-mono">{r.quantity.toLocaleString()}</span>,
            <span className="font-semibold text-emerald-400">{fmt(r.revenue)}</span>,
          ])}
        />
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INVENTORY TAB
// ══════════════════════════════════════════════════════════════════════════════
function InventoryTab({ api }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [inv, low, oos] = await Promise.all([
        api.getInventory(), api.getLowStock(), api.getOutOfStock(),
      ]);
      setData({ inventory: inv?.inventory || [], low: low?.lowStock || [], oos: oos?.outOfStock || [] });
      setLoading(false);
    })();
  }, [api]);

  if (loading) return <Loader />;
  const { inventory, low, oos } = data;

  const filtered = inventory.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase())
  );
  const totalUnits = inventory.reduce((s, i) => s + i.quantity, 0);

  const catMap = {};
  inventory.forEach((i) => {
    const cat = i.code.split("-")[0];
    catMap[cat] = (catMap[cat] || 0) + i.quantity;
  });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total SKUs" value={inventory.length} icon="📦" color="sky" />
        <KpiCard label="Total Units" value={fmtNum(totalUnits)} icon="🔢" color="teal" />
        <KpiCard label="Low Stock" value={low.length} icon="⚠️" color="amber" sub="Below reorder" />
        <KpiCard label="Out of Stock" value={oos.length} icon="🚫" color="rose" sub="Urgent reorder" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <SectionTitle sub="Units by category code">Stock Distribution</SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={50} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <SectionTitle sub="Critically low items">Stock Health</SectionTitle>
          <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 280 }}>
            {low.slice(0, 8).map((item) => {
              const pct = item.level_percent ?? Math.round((item.quantity / item.reorder_level) * 100);
              const isOut = item.is_out_of_stock ?? item.quantity === 0;
              return (
                <div key={item.id ?? item.item_id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-slate-300 truncate" style={{ maxWidth: "65%" }}>{item.item_name ?? item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{item.quantity}</span>
                      {isOut ? <Badge label="Out" variant="danger" /> : <Badge label="Low" variant="warning" />}
                    </div>
                  </div>
                  <StockBar pct={pct} isOut={isOut} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <SectionTitle sub={`${filtered.length} items`}>Full Inventory</SectionTitle>
          <input
            type="text"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-xl px-4 py-2 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50 w-56"
          />
        </div>
        <DataTable
          headers={["Code", "Item Name", "Qty", "Reorder", "Supplier", "Status"]}
          rows={filtered.slice(0, 30).map((i) => {
            const ok = i.quantity >= i.reorder_level;
            const out = i.quantity === 0;
            return [
              <span className="font-mono text-xs text-slate-400">{i.code}</span>,
              i.name,
              <span className={`font-semibold ${out ? "text-rose-400" : !ok ? "text-amber-400" : "text-emerald-400"}`}>{i.quantity}</span>,
              i.reorder_level,
              <span className="text-xs text-slate-400">{i.supplier}</span>,
              out ? <Badge label="Out" variant="danger" /> : !ok ? <Badge label="Low" variant="warning" /> : <Badge label="OK" variant="success" />,
            ];
          })}
        />
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PURCHASES TAB
// ══════════════════════════════════════════════════════════════════════════════
function PurchasesTab({ api }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [grn, daily, monthly, byStatus] = await Promise.all([
        api.getGrnHistory(), api.getGrnDaily(), api.getGrnMonthly(), api.getPurchaseOrdersByStatus(),
      ]);
      setData({
        grn: grn?.grn || [],
        daily: daily?.daily || [],
        monthly: monthly?.monthly || [],
        byStatus: byStatus?.byStatus || [],
      });
      setLoading(false);
    })();
  }, [api]);

  if (loading) return <Loader />;
  const { grn, daily, monthly, byStatus } = data;

  const totalGrn = grn.reduce((s, g) => s + (g.total_amount || 0), 0);
  const fullyReceived = grn.filter((g) => g.status === "Fully Received").length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Purchases" value={fmt(totalGrn)} icon="🛒" color="sky" />
        <KpiCard label="Total GRNs" value={grn.length} icon="📋" color="teal" />
        <KpiCard label="Fully Received" value={fullyReceived} icon="✅" color="emerald" />
        <KpiCard label="Monthly" value={fmt(monthly[0]?.total_amount)} icon="📅" color="violet" sub={`${monthly[0]?.count} GRNs`} />
      </div>

      <Card className="p-6">
        <SectionTitle sub="Purchase amounts by day">Daily GRN Activity</SectionTitle>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={daily.map((d) => ({ ...d, date: fmtDate(d.date) }))} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.slate700} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: C.slate400, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fill: C.slate400, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<TipTooltip />} />
            <Bar dataKey="total_amount" name="Amount" fill={C.sky} radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <SectionTitle sub="Fulfillment breakdown">PO by Status</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} innerRadius={45} paddingAngle={3}>
                {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-slate-300 text-xs">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <SectionTitle sub="Recent goods received notes">GRN History</SectionTitle>
          <DataTable
            headers={["Supplier", "Amount", "Status", "Date"]}
            rows={grn.slice(0, 8).map((g) => [
              <span className="text-xs">{g.supplier}</span>,
              fmt(g.total_amount),
              <Badge label={g.status} variant={g.status === "Fully Received" ? "success" : g.status === "Cancelled" ? "danger" : "warning"} />,
              fmtDate(g.grn_date),
            ])}
          />
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUPPLIERS TAB
// ══════════════════════════════════════════════════════════════════════════════
function SuppliersTab({ api }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const top = await api.getTopSuppliers();
      const topSuppliers = Array.isArray(top?.topSuppliers) ? top.topSuppliers : [];
      setData({ topSuppliers });
      setLoading(false);
    })();
  }, [api]);

  if (loading) return <Loader />;
  const { topSuppliers } = data;
  const supplierList = Array.isArray(topSuppliers) ? topSuppliers : [];
  const totalSpend = supplierList.reduce((s, sup) => s + (sup.total_amount ?? sup.totalAmount ?? 0), 0);

  const topBarData = supplierList.slice(0, 8).map((s) => ({
    name: (s.supplier_name ?? s.name ?? "").split(" ")[0],
    amount: s.total_amount ?? s.totalAmount ?? 0,
  }));

  const perfData = supplierList.filter((s) => s.supplier_name).slice(0, 6).map((s) => ({
    supplier_name: s.supplier_name ?? s.name ?? "",
    order_count: s.order_count ?? 1,
  }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Total Suppliers" value={supplierList.length} icon="🏭" color="amber" />
        <KpiCard label="Total Spend" value={fmt(totalSpend)} icon="💸" color="sky" />
        <KpiCard label="Top Supplier" value={(supplierList[0]?.supplier_name ?? supplierList[0]?.name ?? "—").split(" ")[0]} icon="🏆" color="emerald" sub={fmt(supplierList[0]?.total_amount ?? supplierList[0]?.totalAmount)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <SectionTitle sub="By purchase volume">Top Suppliers</SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topBarData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate700} horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fill: C.slate400, fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: C.slate400, fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
              <Tooltip content={<TipTooltip />} />
              <Bar dataKey="amount" name="Amount" fill={C.amber} radius={[0, 6, 6, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <SectionTitle sub="All supplier overview">Supplier Summary</SectionTitle>
          <DataTable
            headers={["Supplier", "Orders", "Spend"]}
            rows={supplierList.slice(0, 10).map((s) => [
              <span className="text-xs">{s.supplier_name ?? s.name}</span>,
              s.order_count ?? s.orderCount ?? "—",
              <span className="text-amber-400 font-semibold">{fmt(s.total_amount ?? s.totalAmount)}</span>,
            ])}
          />
        </Card>
      </div>

      {perfData.length > 0 && (
        <Card className="p-6">
          <SectionTitle sub="Top suppliers by order count">Supplier Performance</SectionTitle>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={perfData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke={C.slate700} />
              <PolarAngleAxis dataKey="supplier_name" tick={{ fill: C.slate400, fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fill: C.slate600, fontSize: 9 }} />
              <Radar name="Orders" dataKey="order_count" stroke={C.emerald} fill={C.emerald} fillOpacity={0.2} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-slate-300 text-xs">{v}</span>} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROFIT TAB
// ══════════════════════════════════════════════════════════════════════════════
function ProfitTab({ api }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [total, byItem, byDate] = await Promise.all([
        api.getProfitTotal(), api.getProfitByItem(), api.getProfitByDate(),
      ]);
      setData({
        total: total?.total ?? total?.profit ?? 0,
        byItem: byItem?.byItem || [],
        byDate: byDate?.byDate || [],
      });
      setLoading(false);
    })();
  }, [api]);

  if (loading) return <Loader />;
  const { total, byItem, byDate } = data;

  const sortedByProfit = [...byItem].sort((a, b) => b.profit - a.profit);
  const bestItem = sortedByProfit[0];
  const positiveCount = byItem.filter((i) => i.profit > 0).length;
  const avgProfit = byItem.reduce((s, i) => s + i.profit, 0) / (byItem.length || 1);
  const chartData = [...byDate].sort((a, b) => new Date(a.date) - new Date(b.date)).map((d) => ({ ...d, date: fmtDate(d.date) }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Profit/Loss" value={fmt(total)} icon={total >= 0 ? "📈" : "📉"} color={total >= 0 ? "emerald" : "rose"} sub={total < 0 ? "Net deficit" : "Net positive"} />
        <KpiCard label="Best Item" value={bestItem?.item_name?.split(" ")[0] ?? "—"} icon="🏆" color="emerald" sub={fmt(bestItem?.profit)} />
        <KpiCard label="Profitable Items" value={positiveCount} icon="✅" color="teal" sub={`of ${byItem.length} SKUs`} />
        <KpiCard label="Avg Item Profit" value={fmt(avgProfit)} icon="📊" color="violet" />
      </div>

      <Card className="p-6">
        <SectionTitle sub="Sales vs Purchases vs Net Profit over time">Profit Trend</SectionTitle>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.emerald} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.emerald} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.sky} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.sky} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="nG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.amber} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.slate700} />
            <XAxis dataKey="date" tick={{ fill: C.slate400, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fill: C.slate400, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<TipTooltip />} />
            <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-slate-300 text-xs">{v}</span>} />
            <Area type="monotone" dataKey="total_sales" name="Sales" stroke={C.emerald} strokeWidth={2} fill="url(#sG)" />
            <Area type="monotone" dataKey="total_purchases" name="Purchases" stroke={C.sky} strokeWidth={2} fill="url(#pG)" />
            <Area type="monotone" dataKey="profit" name="Net Profit" stroke={C.amber} strokeWidth={2} fill="url(#nG)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <SectionTitle sub="Top profitable products">Profit by Item</SectionTitle>
          <div className="space-y-3">
            {sortedByProfit.slice(0, 10).map((item, i) => (
              <div key={item.item_id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-slate-300 truncate">{item.item_name}</span>
                    <span className="text-xs text-slate-400 ml-2 shrink-0">{fmtNum(item.quantity)} units</span>
                  </div>
                  <div className="bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.profit >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                      style={{ width: `${Math.min((Math.abs(item.profit) / (Math.abs(sortedByProfit[0]?.profit) || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <span className={`text-sm font-semibold shrink-0 w-20 text-right ${item.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmt(item.profit)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle sub="Revenue vs cost vs margin">Profit Table</SectionTitle>
          <DataTable
            headers={["Item", "Revenue", "Cost", "Profit"]}
            rows={sortedByProfit.slice(0, 10).map((i) => [
              <span className="text-xs truncate block" style={{ maxWidth: 100 }}>{i.item_name}</span>,
              fmt(i.revenue),
              fmt(i.estimated_cost),
              <span className={`font-semibold ${i.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmt(i.profit)}</span>,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
export function Reports() {
  const [activeTab, setActiveTab] = useState("overview");
  const api = useReports();

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab api={api} />;
      case "sales": return <SalesTab api={api} />;
      case "inventory": return <InventoryTab api={api} />;
      case "purchases": return <PurchasesTab api={api} />;
      case "suppliers": return <SuppliersTab api={api} />;
      case "profit": return <ProfitTab api={api} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(16,185,129,0.05)" }} />
        <div className="absolute top-1/2 right-0 w-80 h-80 rounded-full blur-3xl" style={{ background: "rgba(14,165,233,0.05)" }} />
        <div className="absolute bottom-0" style={{ left: "33%", width: 288, height: 288, borderRadius: "50%", filter: "blur(64px)", background: "rgba(139,92,246,0.04)" }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: "linear-gradient(135deg,#10b981,#14b8a6)" }}>
                📊
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">Inventory Reports</h1>
            </div>
            <p className="text-sm text-slate-400">Real-time analytics &amp; business intelligence</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 overflow-x-auto pb-1">
          <div className="flex gap-1 bg-slate-800 bg-opacity-40 border border-slate-700 border-opacity-40 rounded-2xl p-1 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                style={activeTab === tab.id ? { background: "linear-gradient(90deg,#10b981,#14b8a6)", boxShadow: "0 4px 20px rgba(16,185,129,0.25)" } : {}}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {api.error && (
          <div className="mb-6 border rounded-xl px-4 py-3 text-sm text-rose-300" style={{ background: "rgba(244,63,94,0.08)", borderColor: "rgba(244,63,94,0.3)" }}>
            ⚠️ {api.error} — Ensure your API server is running and you are authenticated.
          </div>
        )}

        {/* Content */}
        {renderTab()}
      </div>
    </div>
  );
}