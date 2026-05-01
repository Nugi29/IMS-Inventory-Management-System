import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import axios from '../services/httpClient'
import { useContext } from 'react'
import { AppContext } from '../context/AppContext'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useReports } from '../services/useReports'
import { Document, Page, PDFDownloadLink, StyleSheet, Text, View } from '@react-pdf/renderer'

const COLORS = ['#4f46e5', '#14b8a6', '#f97316', '#f43f5e', '#0ea5e9']

const formatCurrency = (value) =>
  `Rs ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const formatNumber = (value) =>
  Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const buildTrendData = (trend) =>
  Array.isArray(trend)
    ? trend.map((item) => ({
        label: item.label || item.date || item.day || item.month || item._id || '',
        value: item.value || item.amount || item.sales || item.total || 0,
      }))
    : []

const buildPieData = (distribution) =>
  Array.isArray(distribution)
    ? distribution.map((item) => ({
        name: item.name || item.label || item.type || 'Unknown',
        value: toNumber(item.value || item.count || item.quantity || 0),
      }))
    : []

const extractTableData = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return { columns: [], rows: [], sourceKey: '' }
  }

  const arrayKey = Object.keys(payload).find((key) => Array.isArray(payload[key]))
  const rows = arrayKey ? payload[arrayKey] : [payload]
  const columns = rows.length ? Object.keys(rows[0]).slice(0, 6) : []

  return { columns, rows, sourceKey: arrayKey || 'payload' }
}

const ReportPdfDocument = ({ summary, topItems, recentSales }) => {
  const styles = StyleSheet.create({
    page: {
      padding: 30,
      fontSize: 11,
      fontFamily: 'Helvetica',
      color: '#1e293b',
    },
    header: {
      fontSize: 18,
      marginBottom: 10,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 13,
      marginTop: 14,
      marginBottom: 8,
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    label: {
      color: '#475569',
    },
    value: {
      fontWeight: '500',
    },
    item: {
      marginBottom: 4,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
    },
    footer: {
      marginTop: 18,
      fontSize: 10,
      color: '#64748b',
    },
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Business Performance Report</Text>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Sales</Text>
          <Text style={styles.value}>{formatCurrency(summary.totalSales)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Purchases</Text>
          <Text style={styles.value}>{formatCurrency(summary.totalPurchases)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Profit</Text>
          <Text style={styles.value}>{formatCurrency(summary.totalProfit)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Low Stock Items</Text>
          <Text style={styles.value}>{formatNumber(summary.lowStock)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Top Items</Text>
        {topItems.slice(0, 5).map((item, index) => (
          <View style={styles.item} key={index}>
            <Text style={styles.label}>{item.name}</Text>
            <Text style={styles.value}>{`${formatNumber(item.units)} units · ${formatCurrency(item.revenue)}`}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Recent Sales</Text>
        {recentSales.slice(0, 5).map((sale, index) => (
          <View style={styles.item} key={index}>
            <Text style={styles.label}>{sale.invoiceId || 'Invoice'}</Text>
            <Text style={styles.value}>{`${formatCurrency(sale.totalAmount)} · ${sale.status}`}</Text>
          </View>
        ))}

        <Text style={styles.footer}>Generated from the IMS reports dashboard.</Text>
      </Page>
    </Document>
  )
}

export const Reports = () => {
  const { reports, isLoadingReports, error, reloadReports } = useReports()
  const { backendUrl } = useContext(AppContext)
  const [activeTab, setActiveTab] = useState('summary')
  const [tabData, setTabData] = useState(null)
  const [isLoadingTab, setIsLoadingTab] = useState(false)

  const trendData = useMemo(() => buildTrendData(reports.salesTrend), [reports.salesTrend])
  const pieData = useMemo(() => buildPieData(reports.stockDistribution), [reports.stockDistribution])
  const topItems = useMemo(
    () =>
      Array.isArray(reports.topItems)
        ? reports.topItems
            .map((item) => ({
              name: item.name || item.item_name || item.itemName || 'Unknown',
              revenue: toNumber(item.revenue || item.total_amount || item.total),
              units: toNumber(item.units || item.quantity || item.qty),
            }))
            .slice(0, 5)
        : [],
    [reports.topItems]
  )
  const recentSales = useMemo(
    () =>
      Array.isArray(reports.recentSales)
        ? reports.recentSales.slice(0, 5)
        : [],
    [reports.recentSales]
  )

  const loadTabData = useCallback(
    async (tab) => {
      setIsLoadingTab(true)
      try {
        const endpoint = `${backendUrl.replace(/\/$/, '')}/api/reports/${tab}`
        const { data } = await axios.get(endpoint)
        setTabData(data)
      } catch {
        toast.error(`Failed to load ${tab} report`)
      } finally {
        setIsLoadingTab(false)
      }
    },
    [backendUrl]
  )

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (tab !== 'summary') {
      loadTabData(tab)
    }
  }

  useEffect(() => {
    if (activeTab !== 'summary' && !tabData) {
      loadTabData(activeTab)
    }
  }, [activeTab, tabData, loadTabData])

  const { sourceKey } = extractTableData(tabData)

  const renderTabTable = (data) => {
    const { columns: tableColumns, rows: tableRows } = extractTableData(data)

    if (!tableRows.length) {
      return <div className="rounded-3xl bg-slate-100 p-12 text-center text-slate-500">No rows available for this report.</div>
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm text-slate-700">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              {tableColumns.map((column) => (
                <th key={column} className="border-b border-slate-200 px-4 py-3">{column.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(0, 10).map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                {tableColumns.map((column) => (
                  <td key={column} className="border-b border-slate-200 px-4 py-3">
                    {typeof row[column] === 'number'
                      ? formatNumber(row[column])
                      : row[column] === null || row[column] === undefined
                      ? '-'
                      : String(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8 min-h-screen bg-slate-50">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Track performance across sales, inventory, and profit with polished charts, insights, and downloadable reports.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reloadReports}
            disabled={isLoadingReports}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined">refresh</span>
            {isLoadingReports ? 'Refreshing...' : 'Refresh Dashboard'}
          </button>

          <PDFDownloadLink
            document={
              <ReportPdfDocument
                summary={reports.summary}
                topItems={topItems}
                recentSales={recentSales}
              />
            }
            fileName="inventory-report.pdf"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Download PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                title: 'Total Sales',
                value: formatCurrency(reports.summary.totalSales),
                icon: 'trending_up',
                accent: 'text-slate-900 bg-slate-100',
              },
              {
                title: 'Total Purchases',
                value: formatCurrency(reports.summary.totalPurchases),
                icon: 'shopping_cart',
                accent: 'text-amber-600 bg-amber-50',
              },
              {
                title: 'Net Profit',
                value: formatCurrency(reports.summary.totalProfit),
                icon: 'paid',
                accent: 'text-emerald-600 bg-emerald-50',
              },
              {
                title: 'Low Stock',
                value: formatNumber(reports.summary.lowStock),
                icon: 'warning',
                accent: 'text-rose-600 bg-rose-50',
              },
              {
                title: 'Orders',
                value: formatNumber(reports.summary.totalOrders),
                icon: 'receipt_long',
                accent: 'text-slate-600 bg-slate-100',
              },
              {
                title: 'Stock Value',
                value: formatCurrency(reports.summary.totalStockValue),
                icon: 'inventory_2',
                accent: 'text-cyan-600 bg-cyan-50',
              },
            ].map((card) => (
              <div key={card.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{card.title}</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-900">{card.value}</h2>
                  </div>
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}>
                    <span className="material-symbols-outlined text-lg">{card.icon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Sales Trend</h3>
                  <p className="text-sm text-slate-500">Revenue movement over time</p>
                </div>
                <span className="text-sm text-slate-500">{trendData.length} points</span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ stroke: '#cbd5e1' }} />
                    <Area type="monotone" dataKey="value" stroke="#4f46e5" fill="url(#trendGradient)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Stock Composition</h3>
                  <p className="text-sm text-slate-500">Inventory distribution by segment</p>
                </div>
                <span className="text-sm text-slate-500">{pieData.length} slices</span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={106} paddingAngle={2}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNumber(value)} />
                    <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Top Selling Items</h3>
              <p className="text-sm text-slate-500">Leading products by revenue and units</p>
            </div>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              Top 5
            </span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItems} margin={{ top: 10, right: 10, left: -10, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => (typeof value === 'number' ? formatNumber(value) : value)} />
                <Legend verticalAlign="top" height={36} />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#4f46e5" radius={[10, 10, 0, 0]} />
                <Bar yAxisId="right" dataKey="units" name="Units" fill="#14b8a6" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Report Explorer</h2>
            <p className="text-sm text-slate-500">Review API-backed reports and export the current dashboard snapshot.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'summary', label: 'Summary' },
              { id: 'sales', label: 'Sales' },
              { id: 'inventory', label: 'Inventory' },
              { id: 'grn', label: 'GRN' },
              { id: 'profit', label: 'Profit' },
              { id: 'stock-movement', label: 'Stock Movement' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                disabled={isLoadingTab && activeTab !== tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-slate-50 p-6">
          {activeTab === 'summary' ? (
            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900 mb-4">Summary details</h3>
                <div className="grid gap-3">
                  {[
                    { label: 'Total Sales', value: formatCurrency(reports.summary.totalSales) },
                    { label: 'Total Purchases', value: formatCurrency(reports.summary.totalPurchases) },
                    { label: 'Total Profit', value: formatCurrency(reports.summary.totalProfit) },
                    { label: 'Low Stock Items', value: formatNumber(reports.summary.lowStock) },
                    { label: 'Total Orders', value: formatNumber(reports.summary.totalOrders) },
                    { label: 'Stock Value', value: formatCurrency(reports.summary.totalStockValue) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-3xl bg-slate-100 p-4">
                      <span className="text-sm text-slate-600">{item.label}</span>
                      <strong className="text-slate-900">{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900 mb-4">Recent sales</h3>
                {recentSales.length ? (
                  <div className="space-y-3">
                    {recentSales.map((sale, idx) => (
                      <div key={idx} className="rounded-3xl bg-slate-100 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{sale.invoiceId || 'Invoice'}</p>
                            <p className="text-xs text-slate-500">{sale.cashier || 'Cashier'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">{formatCurrency(sale.totalAmount)}</p>
                            <p className="text-xs text-slate-500">{sale.status || 'Completed'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl bg-slate-100 p-8 text-center text-sm text-slate-500">No recent sales available.</div>
                )}
              </div>
            </div>
          ) : (
            <div>
              {isLoadingTab ? (
                <div className="rounded-3xl bg-white p-12 text-center text-slate-500">Loading {activeTab} report...</div>
              ) : tabData ? (
                <div className="space-y-4">
                  <div className="rounded-3xl bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 capitalize">{activeTab.replace('-', ' ')} Report</h3>
                        <p className="text-sm text-slate-500">API response preview for the selected report endpoint.</p>
                      </div>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {sourceKey}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white p-6 shadow-sm">
                    {renderTabTable(tabData)}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl bg-white p-12 text-center text-slate-500">No data available for this report.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">{error}</div>
      ) : null}
    </main>
  )
}
