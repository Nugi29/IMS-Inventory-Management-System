import { useCallback, useContext, useEffect, useState } from 'react'
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from './httpClient'
import { AppContext } from '../context/AppContext'

const EMPTY_REPORTS = {
  summary: {
    totalSales: 0,
    totalPurchases: 0,
    totalProfit: 0,
    lowStock: 0,
    totalOrders: 0,
    totalSuppliers: 0,
    totalStockValue: 0,
  },
  salesTrend: [],
  stockDistribution: [],
  topItems: [],
  recentSales: [],
}

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const sanitized = value.replace(/[^0-9.-]+/g, '')
    const parsed = Number(sanitized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const coalesce = (...values) => {
  for (const value of values) {
    const normalized = toNumber(value)
    if (normalized !== 0 || value === 0) {
      return normalized
    }
  }
  return 0
}

const normalizeReportPayload = (payload) => {
  const source = payload?.dashboardData || payload?.data || payload || {}
  const summary = source?.summary || {}
  const topItemsData = source?.topItems || source?.top_selling_items || source?.salesByItem || source?.topSellingItems || source?.topSellingCategory || []
  const distributionData = source?.stockDistribution || source?.inventoryDistribution || source?.stock_distribution || source?.categorySales || []
  const recentSalesData = source?.recentSales || source?.latestSales || source?.sales || source?.salesHistory || []
  const trendData = source?.salesTrend || source?.dailySales || source?.salesByDate || []

  return {
    summary: {
      totalSales: coalesce(summary?.total_sales, summary?.totalSales, source?.total_sales, source?.totalSales),
      totalPurchases: coalesce(summary?.total_purchases, summary?.totalPurchases, source?.total_purchases, source?.totalPurchases),
      totalProfit: coalesce(summary?.total_profit, summary?.totalProfit, source?.total_profit, source?.totalProfit),
      lowStock: coalesce(summary?.low_stock, summary?.lowStock, source?.low_stock, source?.lowStock),
      totalOrders: coalesce(summary?.total_orders, summary?.totalOrders, source?.total_orders, source?.totalOrders),
      totalSuppliers: coalesce(summary?.total_suppliers, summary?.totalSuppliers, source?.total_suppliers, source?.totalSuppliers),
      totalStockValue: coalesce(summary?.total_stock_value, summary?.totalStockValue, source?.total_stock_value, source?.totalStockValue),
    },
    salesTrend: Array.isArray(trendData)
      ? trendData.map((item) => ({
          label: item.label || item.date || item.day || item.month || item._id || item.name || '',
          value: coalesce(item.value, item.amount, item.sales, item.total_sales, item.total),
        }))
      : [],
    stockDistribution: Array.isArray(distributionData)
      ? distributionData.map((item) => ({
          name: item.name || item.label || item.type || 'Unknown',
          value: coalesce(item.value, item.count, item.quantity, item.percentage),
        }))
      : [],
    topItems: Array.isArray(topItemsData)
      ? topItemsData.map((item, index) => ({
          name: item.name || item.itemName || item.label || `Item ${index + 1}`,
          units: coalesce(item.units, item.qty, item.quantity, item.count),
          revenue: coalesce(item.revenue, item.total_amount, item.total, item.salesAmount, item.amount),
        }))
      : [],
    recentSales: Array.isArray(recentSalesData)
      ? recentSalesData.map((item, index) => ({
          date: item.date || item.transaction_date || item.createdAt || item.created_at || '',
          invoiceId: item.invoice_id || item.invoiceId || item.reference || `INV-${index + 1}`,
          cashier: item.cashier || item.user || item.salesperson || 'Unknown',
          totalAmount: coalesce(item.total_amount, item.amount, item.total, item.revenue),
          status: item.status || item.state || 'Completed',
        }))
      : [],
  }
}

export function useReports() {
  const { backendUrl, token } = useContext(AppContext)
  const [reports, setReports] = useState(EMPTY_REPORTS)
  const [isLoadingReports, setIsLoadingReports] = useState(false)
  const [error, setError] = useState(null)

  const fetchUrl = backendUrl ? `${backendUrl.replace(/\/$/, '')}/api/reports/dashboard` : '/api/reports/dashboard'

  const loadReports = useCallback(async () => {
    if (!token) {
      setReports(EMPTY_REPORTS)
      return { success: false, message: 'Unauthorized' }
    }

    setIsLoadingReports(true)
    setError(null)

    try {
      const { data } = await axios.get(fetchUrl)
      const normalized = normalizeReportPayload(data)
      setReports(normalized)
      return { success: true }
    } catch (err) {
      if (isSessionExpiredError(err)) {
        return { success: false, message: SESSION_EXPIRED_MESSAGE }
      }

      const message = err?.response?.data?.message || err?.message || 'Failed to load report data'
      setError(message)
      setReports(EMPTY_REPORTS)
      return { success: false, message }
    } finally {
      setIsLoadingReports(false)
    }
  }, [fetchUrl, token])

  useEffect(() => {
    if (!token) {
      setReports(EMPTY_REPORTS)
      return
    }

    loadReports()
  }, [loadReports, token])

  return {
    reports,
    isLoadingReports,
    error,
    reloadReports: loadReports,
  }
}
