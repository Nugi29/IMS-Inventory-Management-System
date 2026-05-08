import { useCallback, useContext, useState } from 'react'
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from './httpClient'
import { AppContext } from '../context/AppContext'

// ─── Endpoint map ─────────────────────────────────────────────────────────────
const EP = {
  // Summary & Dashboard
  summary:            '/api/reports/summary',
  dashboard:          '/api/reports/dashboard',
  // Sales
  sales:              '/api/reports/sales',
  salesDaily:         '/api/reports/sales/daily',
  salesMonthly:       '/api/reports/sales/monthly',
  salesByItem:        '/api/reports/sales/by-item',
  salesByCashier:     '/api/reports/sales/by-cashier',
  salesTopItems:      '/api/reports/sales/top-items',
  // Inventory
  inventory:          '/api/reports/inventory',
  inventoryValue:     '/api/reports/inventory/value',
  inventoryLow:       '/api/reports/inventory/low-stock',
  inventoryOos:       '/api/reports/inventory/out-of-stock',
  // GRN
  grn:                '/api/reports/grn',
  grnBySupplier:      '/api/reports/grn/by-supplier',
  grnDaily:           '/api/reports/grn/daily',
  grnMonthly:         '/api/reports/grn/monthly',
  // Purchase Orders
  po:                 '/api/reports/purchase-orders',
  poByStatus:         '/api/reports/purchase-orders/status',
  poPending:          '/api/reports/purchase-orders/pending',
  poCompleted:        '/api/reports/purchase-orders/completed',
  // Suppliers
  suppliers:          '/api/reports/suppliers',
  suppliersTop:       '/api/reports/suppliers/top',
  supplierById:       (id) => `/api/reports/suppliers/${id}`,
  // Profit
  profit:             '/api/reports/profit',
  profitByItem:       '/api/reports/profit/by-item',
  profitByDate:       '/api/reports/profit/by-date',
  // Stock Movement
  stockMovement:      '/api/reports/stock-movement',
  stockMovByItem:     '/api/reports/stock-movement/by-item',
  stockMovByType:     '/api/reports/stock-movement/by-type',
  stockMovSummary:    '/api/reports/stock-movement/summary',
  // Stock Adjustments
  stockAdj:           '/api/reports/stock-adjustments',
  stockAdjByItem:     '/api/reports/stock-adjustments/by-item',
  stockAdjReasons:    '/api/reports/stock-adjustments/reasons',
}

export function useReports() {
  const { backendUrl, token } = useContext(AppContext)
  const [error, setError] = useState(null)

  /** Build full URL from a path string or function */
  const url = useCallback(
    (path) => {
      const base = backendUrl ? backendUrl.replace(/\/$/, '') : ''
      const p = typeof path === 'function' ? path() : path
      return `${base}${p}`
    },
    [backendUrl]
  )

  /** Unified error handler */
  const handleError = useCallback((err) => {
    if (isSessionExpiredError(err)) {
      setError(SESSION_EXPIRED_MESSAGE)
      return SESSION_EXPIRED_MESSAGE
    }
    const msg = err?.response?.data?.message || err?.message || 'Failed to load report data'
    setError(msg)
    return msg
  }, [])

  /** Generic GET — returns the raw response data or null on failure */
  const get = useCallback(
    async (path) => {
      if (!token) return null
      try {
        const { data } = await axios.get(url(path))
        return data
      } catch (err) {
        handleError(err)
        return null
      }
    },
    [url, token, handleError]
  )

  // ─── Summary & Dashboard ──────────────────────────────────────────────────
  const getSummary      = useCallback(() => get(EP.summary),   [get])
  const getDashboard    = useCallback(() => get(EP.dashboard),  [get])

  // ─── Sales ───────────────────────────────────────────────────────────────
  const getSales          = useCallback(() => get(EP.sales),          [get])
  const getSalesDaily     = useCallback(() => get(EP.salesDaily),     [get])
  const getSalesMonthly   = useCallback(() => get(EP.salesMonthly),   [get])
  const getSalesByItem    = useCallback(() => get(EP.salesByItem),    [get])
  const getSalesByCashier = useCallback(() => get(EP.salesByCashier), [get])
  const getTopSellingItems= useCallback(() => get(EP.salesTopItems),  [get])

  // ─── Inventory ───────────────────────────────────────────────────────────
  const getInventory      = useCallback(() => get(EP.inventory),      [get])
  const getInventoryValue = useCallback(() => get(EP.inventoryValue), [get])
  const getLowStock       = useCallback(() => get(EP.inventoryLow),   [get])
  const getOutOfStock     = useCallback(() => get(EP.inventoryOos),   [get])

  // ─── GRN ─────────────────────────────────────────────────────────────────
  const getGrnHistory     = useCallback(() => get(EP.grn),           [get])
  const getGrnBySupplier  = useCallback(() => get(EP.grnBySupplier), [get])
  const getGrnDaily       = useCallback(() => get(EP.grnDaily),      [get])
  const getGrnMonthly     = useCallback(() => get(EP.grnMonthly),    [get])

  // ─── Purchase Orders ─────────────────────────────────────────────────────
  const getPurchaseOrders          = useCallback(() => get(EP.po),          [get])
  const getPurchaseOrdersByStatus  = useCallback(() => get(EP.poByStatus),  [get])
  const getPurchaseOrdersPending   = useCallback(() => get(EP.poPending),   [get])
  const getPurchaseOrdersCompleted = useCallback(() => get(EP.poCompleted), [get])

  // ─── Suppliers ───────────────────────────────────────────────────────────
  const getSupplierSummary     = useCallback(() => get(EP.suppliers),    [get])
  const getTopSuppliers        = useCallback(() => get(EP.suppliersTop), [get])
  const getSupplierPerformance = useCallback((id) => get(EP.supplierById(id)), [get])

  // ─── Profit ──────────────────────────────────────────────────────────────
  const getProfitTotal  = useCallback(() => get(EP.profit),        [get])
  const getProfitByItem = useCallback(() => get(EP.profitByItem),  [get])
  const getProfitByDate = useCallback(() => get(EP.profitByDate),  [get])

  // ─── Stock Movement ──────────────────────────────────────────────────────
  const getStockMovementHistory = useCallback(() => get(EP.stockMovement),  [get])
  const getStockMovementByItem  = useCallback(() => get(EP.stockMovByItem), [get])
  const getStockMovementByType  = useCallback(() => get(EP.stockMovByType), [get])
  const getStockMovementSummary = useCallback(() => get(EP.stockMovSummary),[get])

  // ─── Stock Adjustments ───────────────────────────────────────────────────
  const getStockAdjustments        = useCallback(() => get(EP.stockAdj),        [get])
  const getStockAdjustmentsByItem  = useCallback(() => get(EP.stockAdjByItem),  [get])
  const getStockAdjustmentsReasons = useCallback(() => get(EP.stockAdjReasons), [get])

  return {
    error,
    // Summary & Dashboard
    getSummary, getDashboard,
    // Sales
    getSales, getSalesDaily, getSalesMonthly, getSalesByItem,
    getSalesByCashier, getTopSellingItems,
    // Inventory
    getInventory, getInventoryValue, getLowStock, getOutOfStock,
    // GRN
    getGrnHistory, getGrnBySupplier, getGrnDaily, getGrnMonthly,
    // Purchase Orders
    getPurchaseOrders, getPurchaseOrdersByStatus,
    getPurchaseOrdersPending, getPurchaseOrdersCompleted,
    // Suppliers
    getSupplierSummary, getTopSuppliers, getSupplierPerformance,
    // Profit
    getProfitTotal, getProfitByItem, getProfitByDate,
    // Stock Movement
    getStockMovementHistory, getStockMovementByItem,
    getStockMovementByType, getStockMovementSummary,
    // Stock Adjustments
    getStockAdjustments, getStockAdjustmentsByItem, getStockAdjustmentsReasons,
  }
}
