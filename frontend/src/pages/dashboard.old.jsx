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
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
} from 'recharts'
import { AppContext } from '../context/AppContext'
import { resolveRoleConfig } from '../constants/accessControl'
import { useDashboard } from '../services/useDashboard'
import { useRoleBasedDashboard } from '../services/useRoleBasedDashboard'

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



const Dashboard = () => {
  const navigate = useNavigate()
  const { userData } = useContext(AppContext)
  const roleConfig = resolveRoleConfig(userData?.role)
  const permissions = roleConfig.permissions
  const userRole = roleConfig.key

  const { dashboard, isLoadingDashboard } = useDashboard()
  const { insights: roleInsights, isLoading: isLoadingInsights } = useRoleBasedDashboard(userRole)

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

  const grnBiData = useMemo(() => {
    const total = Number(summary.total_grn_today || 0)
    const pending = Number(summary.pending_grn_today || 0)
    return [
      { name: 'Processed', value: Math.max(total - pending, 0), fill: '#2563eb' },
      { name: 'Pending', value: pending, fill: '#f59e0b' },
    ]
  }, [summary])

  // Cashier specific render
  const CashierView = () => {
    const data = roleInsights || {}
    const topItems = (data.topItems || []).slice(0, 5)
    const paymentBreakdown = data.paymentBreakdown || []

    return (
      <>
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-amber-100 bg-linear-to-br from-amber-50 via-white to-slate-50 p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-200/50 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-yellow-200/40 blur-3xl" />

          <div className="relative mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Sales Performance
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-[27px]">
              Today's cash register summary
            </h2>
          </div>

          <div className="relative mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Total Sales</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{fmtCompactMoney(data.todaySalesAmount || 0)}</p>
              <p className="mt-1 text-xs text-slate-600">{data.todayTransactions || 0} transactions</p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Growth vs Yesterday</p>
              <p className={`mt-2 text-2xl font-bold ${data.salesGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {data.salesGrowth >= 0 ? '+' : ''}{data.salesGrowth?.toFixed(1) || 0}%
              </p>
              <p className="mt-1 text-xs text-slate-600">Daily comparison</p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Avg Transaction</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.todayTransactions > 0
                  ? fmtCompactMoney((data.todaySalesAmount || 0) / data.todayTransactions)
                  : fmtCompactMoney(0)}
              </p>
              <p className="mt-1 text-xs text-slate-600">Per transaction</p>
            </div>
          </div>

          <div className="relative mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-700">Top Selling Items</p>
              <div className="space-y-2">
                {topItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 p-2">
                    <p className="text-sm text-slate-700">{item.itemName}</p>
                    <p className="text-xs font-semibold text-amber-600">{item.quantity} sold</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-700">Payment Methods</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentBreakdown} layout="vertical" margin={{ left: 80, right: 10, top: 5, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="method" width={75} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Bar dataKey="amount" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {quickLinks.length > 0 && (
            <div className="relative rounded-2xl border border-amber-100 bg-white p-3 shadow-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {quickLinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => navigate(link.path)}
                    className="inline-flex items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-700 transition-all duration-150 hover:bg-amber-100 active:scale-95"
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

        <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {permissions.sales && (
            <SectionCard title="Sales Trend" subtitle="Last 7 days revenue">
              <SalesChart trend={salesTrend} />
            </SectionCard>
          )}
          <SectionCard title="Quick Stats" subtitle="Today overview">
            <div className="space-y-2">
              <div className="flex justify-between rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-600">Transactions</p>
                <p className="font-semibold text-slate-900">{data.todayTransactions || 0}</p>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-600">Total Items Sold</p>
                <p className="font-semibold text-slate-900">{topItems.reduce((sum, item) => sum + item.quantity, 0)}</p>
              </div>
            </div>
          </SectionCard>
        </section>
      </>
    )
  }

  // Storekeeper specific render
  const StorekeeperView = () => {
    const data = roleInsights || {}
    const fastMoving = (data.fastMoving || []).slice(0, 5)
    const slowMoving = (data.slowMoving || []).slice(0, 5)

    return (
      <>
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-teal-100 bg-linear-to-br from-teal-50 via-white to-slate-50 p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-teal-200/50 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-cyan-200/40 blur-3xl" />

          <div className="relative mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              Warehouse Status
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-[27px]">
              Inventory management overview
            </h2>
          </div>

          <div className="relative mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Out of Stock</p>
              <p className="mt-2 text-3xl font-bold text-rose-600">{data.outOfStock || 0}</p>
              <p className="mt-1 text-xs text-slate-600">Critical alert</p>
            </div>

            <div className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Low Stock</p>
              <p className="mt-2 text-3xl font-bold text-amber-600">{data.criticalLowStock || 0}</p>
              <p className="mt-1 text-xs text-slate-600">Reorder soon</p>
            </div>

            <div className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Today GRN</p>
              <p className="mt-2 text-3xl font-bold text-teal-600">{data.todayGrnCount || 0}</p>
              <p className="mt-1 text-xs text-slate-600">Received</p>
            </div>

            <div className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Pending GRN</p>
              <p className="mt-2 text-3xl font-bold text-orange-600">{(data.pendingGrnSummary || []).length}</p>
              <p className="mt-1 text-xs text-slate-600">In progress</p>
            </div>
          </div>

          {quickLinks.length > 0 && (
            <div className="relative rounded-2xl border border-teal-100 bg-white p-3 shadow-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {quickLinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => navigate(link.path)}
                    className="inline-flex items-center justify-between gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 text-sm font-semibold text-teal-700 transition-all duration-150 hover:bg-teal-100 active:scale-95"
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

        <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {permissions.grn && (
            <SectionCard title="Pending GRN" subtitle="Requires immediate attention">
              <div className="space-y-2">
                {(data.pendingGrnSummary || []).slice(0, 5).map((grn, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{grn.grnNo}</p>
                      <p className="text-xs text-slate-500">{grn.supplier}</p>
                    </div>
                    <span className="text-xs font-bold text-orange-600">{grn.status}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          <SectionCard title="Item Movement" subtitle="Fast and slow moving items">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-emerald-700 mb-2">Fast Moving</p>
                <div className="space-y-1">
                  {fastMoving.map((item, idx) => (
                    <div key={idx} className="text-xs text-slate-600 bg-emerald-50 p-2 rounded">
                      <p className="font-semibold truncate">{item.itemName}</p>
                      <p>{item.quantitySold} units</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-amber-700 mb-2">Slow Moving</p>
                <div className="space-y-1">
                  {slowMoving.map((item, idx) => (
                    <div key={idx} className="text-xs text-slate-600 bg-amber-50 p-2 rounded">
                      <p className="font-semibold truncate">{item.itemName}</p>
                      <p>{item.currentQty} in stock</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </section>

        {permissions.inventory && (
          <section className="mb-4">
            <SectionCard title="Inventory Alerts" subtitle="Critical stock items">
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
              </div>
            </SectionCard>
          </section>
        )}
      </>
    )
  }

  // Manager specific render
  const ManagerView = () => {
    const data = roleInsights || {}
    const topSuppliers = (data.topSuppliers || []).slice(0, 5)

    return (
      <>
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-indigo-100 bg-linear-to-br from-indigo-50 via-white to-slate-50 p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-200/50 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-purple-200/40 blur-3xl" />

          <div className="relative mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Business Intelligence
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-[27px]">
              Monthly performance & trends
            </h2>
          </div>

          <div className="relative mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Month Sales</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{fmtCompactMoney(data.monthSales || 0)}</p>
              <p className="mt-1 text-xs text-slate-600">Current month total</p>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Month Growth</p>
              <p className={`mt-2 text-2xl font-bold ${data.monthGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {data.monthGrowth >= 0 ? '+' : ''}{data.monthGrowth?.toFixed(1) || 0}%
              </p>
              <p className="mt-1 text-xs text-slate-600">vs last month</p>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">GRN Spend</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{fmtCompactMoney(data.grnSpend || 0)}</p>
              <p className="mt-1 text-xs text-slate-600">Purchase orders</p>
            </div>
          </div>

          {quickLinks.length > 0 && (
            <div className="relative rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {quickLinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => navigate(link.path)}
                    className="inline-flex items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700 transition-all duration-150 hover:bg-indigo-100 active:scale-95"
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

        <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {permissions.sales && (
            <SectionCard title="Sales Trend" subtitle="Last 7 days">
              <SalesChart trend={salesTrend} />
            </SectionCard>
          )}
          <SectionCard title="Top Suppliers" subtitle="By purchase value">
            <div className="space-y-2">
              {topSuppliers.map((supplier, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-800">{supplier.supplierName}</p>
                    <p className="text-xs font-bold text-indigo-600">{supplier.grnCount} GRNs</p>
                  </div>
                  <p className="text-xs text-slate-600">{fmtCompactMoney(supplier.totalValue)}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </section>
      </>
    )
  }

  // Admin specific render
  const AdminView = () => {
    const data = roleInsights || {}

    return (
      <>
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-slate-50 p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-200/50 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-indigo-200/40 blur-3xl" />

          <div className="relative mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              System Overview
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-[27px]">
              Platform health & analytics
            </h2>
          </div>

          <div className="relative mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Total Users</p>
              <p className="mt-2 text-3xl font-bold text-blue-600">{data.totalUsers || 0}</p>
              <p className="mt-1 text-xs text-slate-600">System accounts</p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Active This Week</p>
              <p className="mt-2 text-3xl font-bold text-blue-600">{data.activeUsersThisWeek || 0}</p>
              <p className="mt-1 text-xs text-slate-600">Recent logins</p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Data Completeness</p>
              <p className="mt-2 text-3xl font-bold text-emerald-600">{data.dataCompleteness || 0}%</p>
              <p className="mt-1 text-xs text-slate-600">Records quality</p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">System Status</p>
              <p className="mt-2 text-lg font-bold text-emerald-600 uppercase">{data.systemStatus || 'N/A'}</p>
              <p className="mt-1 text-xs text-slate-600">Platform health</p>
            </div>
          </div>

          {quickLinks.length > 0 && (
            <div className="relative rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
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

        {permissions.sales && (
          <section className="mb-4">
            <SectionCard title="Sales Trend" subtitle="Last 7 days revenue">
              <SalesChart trend={salesTrend} />
            </SectionCard>
          </section>
        )}
      </>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      {userRole === 'cashier' && <CashierView />}
      {userRole === 'storekeeper' && <StorekeeperView />}
      {userRole === 'manager' && <ManagerView />}
      {userRole === 'admin' && <AdminView />}

      {isLoadingDashboard || isLoadingInsights && (
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
