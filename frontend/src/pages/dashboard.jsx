import { useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AppContext } from '../context/AppContext'
import { resolveRoleConfig } from '../constants/accessControl'
import { useDashboard } from '../services/useDashboard'

const fmtMoney = (value) =>
  `Rs ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const fmtCompactMoney = (value) => {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `Rs ${(n / 1_000).toFixed(0)}K`
  return fmtMoney(n)
}

const relTime = (dateValue) => {
  if (!dateValue) return 'Just now'
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return 'Just now'
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const EMPTY_SUMMARY = {
  total_sales_today: 0,
  total_sales_count_today: 0,
  total_items: 0,
  low_stock_count: 0,
  total_suppliers: 0,
  total_grn_today: 0,
  pending_grn_today: 0,
  total_stock_value: 0,
}

const EMPTY_SALES_TREND = [
  { label: 'Mon', amount: 0 },
  { label: 'Tue', amount: 0 },
  { label: 'Wed', amount: 0 },
  { label: 'Thu', amount: 0 },
  { label: 'Fri', amount: 0 },
  { label: 'Sat', amount: 0 },
  { label: 'Sun', amount: 0 },
]

const EMPTY_LIST = []

const permissionBlock = (title) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
    <span className="material-symbols-outlined text-2xl text-slate-400">lock</span>
    <p className="mt-2 text-sm font-semibold text-slate-700">No access to {title}</p>
    <p className="text-xs text-slate-500">Your role does not allow this section.</p>
  </div>
)

const SectionCard = ({ title, subtitle, children, right }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
)

const MetricTile = ({ label, value, hint, icon, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
        <span className={`rounded-lg border p-1.5 ${tones[tone] || tones.blue}`}>
          <span className="material-symbols-outlined text-base">{icon}</span>
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  )
}

const SalesChart = ({ trend }) => {
  const chartData = useMemo(
    () =>
      trend.map((entry) => ({
        label: entry?.label || '-',
        displayLabel: entry?.displayLabel || entry?.label || '-',
        amount: Number(entry?.amount || 0),
      })),
    [trend],
  )

  const peak = useMemo(
    () => Math.max(...chartData.map((entry) => entry.amount), 0),
    [chartData],
  )

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="displayLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
            tickFormatter={(value) => fmtCompactMoney(value)}
            width={70}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '14px',
              boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
            }}
            labelStyle={{ color: '#334155', fontWeight: 700 }}
            formatter={(value) => [fmtMoney(value), 'Sales']}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#2563eb"
            strokeWidth={3}
            fill="url(#salesGradient)"
            activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500">
        <span>Peak: {fmtCompactMoney(peak)}</span>
        <span>7 day trend</span>
      </div>
    </div>
  )
}

const DecisionBadge = ({ label, value, tone = 'slate', icon }) => {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }

  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone] || tones.slate}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]">
        {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
        {label}
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  )
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { userData } = useContext(AppContext)
  const roleConfig = resolveRoleConfig(userData?.role)
  const permissions = roleConfig.permissions

  const { dashboard, isLoadingDashboard } = useDashboard()
  const summary = useMemo(() => dashboard?.summary || EMPTY_SUMMARY, [dashboard])

  const salesTrend = useMemo(
    () => (dashboard?.salesTrend?.length ? dashboard.salesTrend : EMPTY_SALES_TREND),
    [dashboard],
  )

  const recentSales = useMemo(
    () => (Array.isArray(dashboard?.recentSales) ? dashboard.recentSales : EMPTY_LIST),
    [dashboard],
  )
  const lowStockItems = useMemo(
    () => (Array.isArray(dashboard?.lowStockItems) ? dashboard.lowStockItems : EMPTY_LIST),
    [dashboard],
  )
  const purchaseActivity = useMemo(
    () => (Array.isArray(dashboard?.purchaseActivity) ? dashboard.purchaseActivity : EMPTY_LIST),
    [dashboard],
  )
  const liveFeed = useMemo(
    () => (Array.isArray(dashboard?.liveFeed) ? dashboard.liveFeed : EMPTY_LIST),
    [dashboard],
  )

  const recentSalesTotal = useMemo(
    () => recentSales.reduce((sum, sale) => sum + Number(sale?.total_amount || 0), 0),
    [recentSales],
  )

  const decisionModel = useMemo(() => {
    const lowStockCount = Number(summary.low_stock_count || 0)
    const pendingGrn = Number(summary.pending_grn_today || 0)
    const totalSalesToday = Number(summary.total_sales_today || 0)
    const totalSalesCount = Number(summary.total_sales_count_today || 0)
    const trendValues = salesTrend.map((point) => Number(point?.amount || 0))
    const todayTrend = trendValues[trendValues.length - 1] || 0
    const yesterdayTrend = trendValues[trendValues.length - 2] || 0
    const trendChange = yesterdayTrend > 0 ? ((todayTrend - yesterdayTrend) / yesterdayTrend) * 100 : 0

    const health =
      lowStockCount >= 20 || pendingGrn >= 5
        ? { label: 'Critical', tone: 'rose' }
        : lowStockCount >= 8 || pendingGrn >= 2
          ? { label: 'Watch', tone: 'amber' }
          : { label: 'Stable', tone: 'emerald' }

    const priorities = [
      {
        id: 'low-stock',
        show: permissions.inventory && lowStockCount > 0,
        text: `Review ${lowStockCount} low-stock items and raise purchase orders`,
        tone: lowStockCount >= 10 ? 'rose' : 'amber',
        icon: 'inventory_2',
      },
      {
        id: 'pending-grn',
        show: permissions.grn && pendingGrn > 0,
        text: `Clear ${pendingGrn} pending GRN records to unblock inventory accuracy`,
        tone: pendingGrn >= 3 ? 'rose' : 'amber',
        icon: 'receipt_long',
      },
      {
        id: 'sales-push',
        show: permissions.sales && totalSalesCount < 15,
        text: 'Sales volume is low today, trigger cashier upsell push',
        tone: 'blue',
        icon: 'point_of_sale',
      },
      {
        id: 'healthy-run',
        show: true,
        text: 'No major blockers, keep normal operations and monitor feed',
        tone: 'emerald',
        icon: 'verified',
      },
    ]
      .filter((item) => item.show)
      .slice(0, 3)

    return {
      health,
      trendChange,
      totalSalesToday,
      totalSalesCount,
      priorities,
    }
  }, [summary, salesTrend, permissions])

  const quickLinks = useMemo(
    () => [
      { id: 'sales', label: 'Open Sales', icon: 'point_of_sale', path: '/sales', show: permissions.sales, priority: true },
      { id: 'items', label: 'Manage Items', icon: 'inventory_2', path: '/items', show: permissions.inventory, priority: false },
      { id: 'grn', label: 'Go To GRN', icon: 'receipt_long', path: '/grns', show: permissions.grn, priority: false },
      { id: 'po', label: 'Purchase Orders', icon: 'local_shipping', path: '/po', show: permissions.purchaseOrders, priority: false },
      { id: 'reports', label: 'View Reports', icon: 'assessment', path: '/reports', show: permissions.reports, priority: false },
    ].filter((link) => link.show),
    [permissions],
  )

  const salesBiData = useMemo(
    () => salesTrend.map((point) => ({ day: point?.label || '-', amount: Number(point?.amount || 0) })),
    [salesTrend],
  )

  const stockRiskValue = useMemo(() => {
    const totalItems = Number(summary.total_items || 0)
    const lowStockCount = Number(summary.low_stock_count || 0)
    if (!totalItems) return 0
    return Math.min(100, Math.round((lowStockCount / totalItems) * 100))
  }, [summary])

  const grnBiData = useMemo(() => {
    const total = Number(summary.total_grn_today || 0)
    const pending = Number(summary.pending_grn_today || 0)
    return [
      { name: 'Processed', value: Math.max(total - pending, 0), fill: '#2563eb' },
      { name: 'Pending', value: pending, fill: '#f59e0b' },
    ]
  }, [summary])

  const trendToneClass =
    decisionModel.trendChange < -10
      ? 'text-rose-600 bg-rose-50 border-rose-200'
      : decisionModel.trendChange < 0
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-emerald-700 bg-emerald-50 border-emerald-200'

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-slate-50 p-5 shadow-sm sm:p-6 lg:p-7">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-indigo-200/40 blur-3xl" />

        <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              BI Snapshot
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-[27px]">
              First look recommendations
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
            <span className="material-symbols-outlined text-sm text-blue-600">schedule</span>
            Updated from live dashboard data
          </div>
        </div>

        <div className="relative mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <DecisionBadge
            label="Health"
            value={decisionModel.health.label}
            tone={decisionModel.health.tone}
            icon="monitoring"
          />
          <DecisionBadge
            label="Momentum"
            value={`${decisionModel.trendChange >= 0 ? '+' : ''}${decisionModel.trendChange.toFixed(1)}% vs yesterday`}
            tone={decisionModel.trendChange < -10 ? 'rose' : decisionModel.trendChange < 0 ? 'amber' : 'emerald'}
            icon="trending_up"
          />
          <DecisionBadge
            label="Today"
            value={`${fmtCompactMoney(decisionModel.totalSalesToday)} · ${decisionModel.totalSalesCount} sales`}
            tone="blue"
            icon="payments"
          />
        </div>

        <div className="relative mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Sales Pulse</p>
            <p className="mb-2 text-lg font-bold text-slate-900">{fmtCompactMoney(decisionModel.totalSalesToday)}</p>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesBiData}>
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Sales Flow</p>
            <div className={`mb-2 inline-flex rounded-lg border px-2 py-1 text-[11px] font-semibold ${trendToneClass}`}>
              {decisionModel.trendChange >= 0 ? '+' : ''}{decisionModel.trendChange.toFixed(1)}%
            </div>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesBiData}>
                  <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Stock Risk</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-slate-900">{stockRiskValue}%</p>
                <p className="text-[11px] font-semibold text-slate-500">At-risk items</p>
              </div>
              <div className="h-20 w-20">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="65%"
                    outerRadius="100%"
                    barSize={10}
                    data={[{ value: stockRiskValue }]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={10} fill={stockRiskValue > 25 ? '#f59e0b' : '#2563eb'} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">GRN Mix</p>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grnBiData} layout="vertical" margin={{ left: 4, right: 4, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={58} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {grnBiData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">{summary.pending_grn_today || 0} pending</p>
          </div>
        </div>

        {quickLinks.length > 0 && (
          <div className="relative rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {quickLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={`inline-flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-95 ${
                    link.priority
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200 hover:bg-blue-700'
                      : 'border border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">{link.icon}</span>
                    {link.label}
                  </span>
                  <span className="material-symbols-outlined text-[16px] opacity-80">arrow_forward</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricTile
          label="Sales Today"
          value={fmtCompactMoney(summary.total_sales_today)}
          hint={`${summary.total_sales_count_today || 0} transactions`}
          icon="payments"
          tone="blue"
        />
        <MetricTile
          label="Total Items"
          value={summary.total_items || 0}
          hint="Registered inventory"
          icon="inventory_2"
          tone="indigo"
        />
        <MetricTile
          label="Low Stock"
          value={summary.low_stock_count || 0}
          hint="Needs attention"
          icon="warning"
          tone="amber"
        />
        <MetricTile
          label="Suppliers"
          value={summary.total_suppliers || 0}
          hint="Active in system"
          icon="local_shipping"
          tone="teal"
        />
        <MetricTile
          label="GRN Today"
          value={summary.total_grn_today || 0}
          hint={`Pending ${summary.pending_grn_today || 0}`}
          icon="receipt_long"
          tone="rose"
        />
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {permissions.sales ? (
            <SectionCard
              title="Sales Trend"
              subtitle="Revenue for the last 7 days"
              right={<p className="text-xs font-semibold text-slate-600">Peak: {fmtCompactMoney(Math.max(...salesTrend.map((t) => Number(t.amount || 0)), 0))}</p>}
            >
              <SalesChart trend={salesTrend} />
            </SectionCard>
          ) : (
            permissionBlock('Sales Trend')
          )}
        </div>
        <div className="lg:col-span-4">
          <SectionCard title="Stock Value" subtitle="Current valuation">
            <p className="text-3xl font-bold text-slate-900">{fmtCompactMoney(summary.total_stock_value)}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-3/4 rounded-full bg-linear-to-r from-blue-500 to-indigo-500" />
            </div>
            <p className="mt-2 text-xs text-slate-500">Calculated from latest purchase layer values.</p>
          </SectionCard>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {permissions.sales ? (
          <SectionCard title="Recent Sales" subtitle={`Last ${Math.min(recentSales.length, 5)} transactions`}>
            <div className="space-y-2">
              {recentSales.slice(0, 5).map((sale, index) => (
                <div
                  key={sale?.id || index}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{sale?.invoice_no || `INV-${sale?.id || index}`}</p>
                    <p className="text-xs text-slate-500">{relTime(sale?.sale_date)} • {sale?.payment_method || 'Sale'}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{fmtMoney(sale?.total_amount)}</p>
                </div>
              ))}
              {!recentSales.length && <p className="py-4 text-center text-sm text-slate-500">No recent sales.</p>}
            </div>
          </SectionCard>
        ) : (
          permissionBlock('Recent Sales')
        )}

        {permissions.inventory ? (
          <SectionCard title="Inventory Alerts" subtitle="Low stock and out-of-stock items">
            <div className="space-y-2">
              {lowStockItems.slice(0, 5).map((item, index) => {
                const level = Number(item?.level_percent || 0)
                const isOut = Boolean(item?.is_out_of_stock)
                return (
                  <div key={item?.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-800">{item?.item_name || 'Unnamed item'}</p>
                      <span className={`text-xs font-bold ${isOut ? 'text-rose-600' : 'text-amber-600'}`}>
                        {isOut ? 'OUT' : `${item?.quantity || 0} left`}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${isOut ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${isOut ? 0 : level}%` }} />
                    </div>
                  </div>
                )
              })}
              {!lowStockItems.length && <p className="py-4 text-center text-sm text-slate-500">No low stock alerts.</p>}
            </div>
          </SectionCard>
        ) : (
          permissionBlock('Inventory Alerts')
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {permissions.grn ? (
            <SectionCard title="Purchase Activity" subtitle="Incoming stock and GRN summary">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                      <th className="px-3 py-2">GRN</th>
                      <th className="px-3 py-2">Supplier</th>
                      <th className="px-3 py-2">Units</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseActivity.slice(0, 5).map((row, index) => (
                      <tr key={row?.id || index} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-3 font-semibold text-slate-800">{row?.grn_no || `GRN-${row?.id || index}`}</td>
                        <td className="px-3 py-3 text-slate-600">{row?.supplier_name || '-'}</td>
                        <td className="px-3 py-3 text-slate-600">{row?.items_received || 0} units</td>
                        <td className="px-3 py-3 text-slate-600">{row?.status_name || 'Unknown'}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-800">{fmtMoney(row?.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!purchaseActivity.length && <p className="py-4 text-center text-sm text-slate-500">No purchase activity.</p>}
              </div>
            </SectionCard>
          ) : (
            permissionBlock('Purchase Activity')
          )}
        </div>

        <div className="lg:col-span-4">
          {permissions.stockMovement ? (
            <SectionCard
              title="Live Feed"
              subtitle="Latest stock and sales events"
              right={<span className="text-xs font-semibold text-slate-600">Total: {fmtMoney(recentSalesTotal)}</span>}
            >
              <div className="space-y-3">
                {liveFeed.slice(0, 5).map((entry, index) => (
                  <div key={entry?.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">{entry?.title || 'System event'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{entry?.actor || 'System'} • {relTime(entry?.createdAt)}</p>
                    <p className="mt-2 text-xs text-slate-600">{entry?.description || 'No details available.'}</p>
                  </div>
                ))}
                {!liveFeed.length && <p className="py-4 text-center text-sm text-slate-500">No live feed events.</p>}
              </div>
            </SectionCard>
          ) : (
            permissionBlock('Live Feed')
          )}
        </div>
      </section>

      {permissions.users && (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">User Management Snapshot</h2>
          <p className="text-xs text-slate-500">Visible for admin role only.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Users', value: '24' },
              { label: 'Active Now', value: '7' },
              { label: 'Pending Invite', value: '3' },
              { label: 'Roles Defined', value: '4' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {isLoadingDashboard && (
        <div className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          Loading dashboard data
        </div>
      )}
    </main>
  )
}

export { Dashboard }
export default Dashboard
