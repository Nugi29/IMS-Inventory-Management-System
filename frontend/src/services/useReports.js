import { useCallback, useContext, useState } from 'react'
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from './httpClient'
import { AppContext } from '../context/AppContext'

export function useReports() {
  const { backendUrl } = useContext(AppContext)
  const [error, setError] = useState(null)

  const baseUrl = backendUrl ? `${backendUrl.replace(/\/$/, '')}/api/reports` : '/api/reports'

  const handleError = useCallback((err) => {
    if (isSessionExpiredError(err)) {
      setError(SESSION_EXPIRED_MESSAGE)
      return SESSION_EXPIRED_MESSAGE
    }
    const message = err?.response?.data?.message || err?.message || 'Failed to load report data'
    setError(message)
    return message
  }, [])

  // ─── SUMMARY & DASHBOARD ─────────────────────────────────────────────────
  const getSummary = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/summary`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getDashboard = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/dashboard`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  // ─── SALES ENDPOINTS ─────────────────────────────────────────────────────
  const getSales = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/sales`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getSalesDaily = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/sales/daily`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getSalesMonthly = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/sales/monthly`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getSalesByItem = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/sales/by-item`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getSalesByCashier = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/sales/by-cashier`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getTopSellingItems = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/sales/top-items`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  // ─── INVENTORY ENDPOINTS ─────────────────────────────────────────────────
  const getInventory = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/inventory`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getInventoryValue = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/inventory/value`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getLowStock = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/inventory/low-stock`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getOutOfStock = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/inventory/out-of-stock`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  // ─── GRN (GOODS RECEIVED NOTE) ENDPOINTS ──────────────────────────────────
  const getGrnHistory = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/grn`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getGrnBySupplier = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/grn/by-supplier`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getGrnDaily = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/grn/daily`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getGrnMonthly = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/grn/monthly`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  // ─── PURCHASE ORDER ENDPOINTS ────────────────────────────────────────────
  const getPurchaseOrders = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/purchase-orders`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getPurchaseOrdersByStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/purchase-orders/status`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getPurchaseOrdersPending = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/purchase-orders/pending`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getPurchaseOrdersCompleted = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/purchase-orders/completed`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  // ─── SUPPLIER ENDPOINTS ──────────────────────────────────────────────────
  const getSupplierSummary = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/suppliers`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getTopSuppliers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/suppliers/top`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getSupplierPerformance = useCallback(async (id) => {
    try {
      const { data } = await axios.get(`${baseUrl}/suppliers/${id}`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  // ─── PROFIT ENDPOINTS ────────────────────────────────────────────────────
  const getProfitTotal = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/profit`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getProfitByItem = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/profit/by-item`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getProfitByDate = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/profit/by-date`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  // ─── STOCK MOVEMENT ENDPOINTS ────────────────────────────────────────────
  const getStockMovementHistory = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/stock-movement`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getStockMovementByItem = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/stock-movement/by-item`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getStockMovementByType = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/stock-movement/by-type`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getStockMovementSummary = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/stock-movement/summary`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  // ─── STOCK ADJUSTMENTS ENDPOINTS ─────────────────────────────────────────
  const getStockAdjustments = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/stock-adjustments`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getStockAdjustmentsByItem = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/stock-adjustments/by-item`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  const getStockAdjustmentsReasons = useCallback(async () => {
    try {
      const { data } = await axios.get(`${baseUrl}/stock-adjustments/reasons`)
      return data
    } catch (err) {
      handleError(err)
      return null
    }
  }, [baseUrl, handleError])

  return {
    error,
    // Summary & Dashboard
    getSummary,
    getDashboard,
    // Sales
    getSales,
    getSalesDaily,
    getSalesMonthly,
    getSalesByItem,
    getSalesByCashier,
    getTopSellingItems,
    // Inventory
    getInventory,
    getInventoryValue,
    getLowStock,
    getOutOfStock,
    // GRN
    getGrnHistory,
    getGrnBySupplier,
    getGrnDaily,
    getGrnMonthly,
    // Purchase Orders
    getPurchaseOrders,
    getPurchaseOrdersByStatus,
    getPurchaseOrdersPending,
    getPurchaseOrdersCompleted,
    // Stock Movement
    getStockMovementHistory,
    getStockMovementByItem,
    getStockMovementByType,
    getStockMovementSummary,
    // Stock Adjustments
    getStockAdjustments,
    getStockAdjustmentsByItem,
    getStockAdjustmentsReasons,
    // Suppliers
    getSupplierSummary,
    getTopSuppliers,
    getSupplierPerformance,
    // Profit
    getProfitTotal,
    getProfitByItem,
    getProfitByDate,
  }
}
