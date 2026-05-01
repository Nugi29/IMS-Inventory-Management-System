const express = require('express')
const authUser = require('../middlewares/AuthUser')
const {
  getSummary,
  getDashboard,
  getSales,
  getSalesDaily,
  getSalesMonthly,
  getSalesByItem,
  getSalesByCashier,
  getTopSellingItems,
  getInventory,
  getInventoryValue,
  getLowStock,
  getOutOfStock,
  getGrnHistory,
  getGrnBySupplier,
  getGrnDaily,
  getGrnMonthly,
  getPurchaseOrders,
  getPurchaseOrdersByStatus,
  getPurchaseOrdersPending,
  getPurchaseOrdersCompleted,
  getStockMovementHistory,
  getStockMovementByItem,
  getStockMovementByType,
  getStockMovementSummary,
  getStockAdjustments,
  getStockAdjustmentsByItem,
  getStockAdjustmentsReasons,
  getSupplierSummary,
  getTopSuppliers,
  getSupplierPerformance,
  getProfitTotal,
  getProfitByItem,
  getProfitByDate,
} = require('../controllers/ReportsController')

const router = express.Router()

router.get('/summary', authUser, getSummary)
router.get('/dashboard', authUser, getDashboard)

// Sales reports
router.get('/sales', authUser, getSales)
router.get('/sales/daily', authUser, getSalesDaily)
router.get('/sales/monthly', authUser, getSalesMonthly)
router.get('/sales/by-item', authUser, getSalesByItem)
router.get('/sales/by-cashier', authUser, getSalesByCashier)
router.get('/sales/top-items', authUser, getTopSellingItems)

// Inventory reports
router.get('/inventory', authUser, getInventory)
router.get('/inventory/value', authUser, getInventoryValue)
router.get('/inventory/low-stock', authUser, getLowStock)
router.get('/inventory/out-of-stock', authUser, getOutOfStock)

// GRN / purchase reports
router.get('/grn', authUser, getGrnHistory)
router.get('/grn/by-supplier', authUser, getGrnBySupplier)
router.get('/grn/daily', authUser, getGrnDaily)
router.get('/grn/monthly', authUser, getGrnMonthly)

// Purchase order reports
router.get('/purchase-orders', authUser, getPurchaseOrders)
router.get('/purchase-orders/status', authUser, getPurchaseOrdersByStatus)
router.get('/purchase-orders/pending', authUser, getPurchaseOrdersPending)
router.get('/purchase-orders/completed', authUser, getPurchaseOrdersCompleted)

// Stock movement reports
router.get('/stock-movement', authUser, getStockMovementHistory)
router.get('/stock-movement/by-item', authUser, getStockMovementByItem)
router.get('/stock-movement/by-type', authUser, getStockMovementByType)
router.get('/stock-movement/summary', authUser, getStockMovementSummary)

// Stock adjustments
router.get('/stock-adjustments', authUser, getStockAdjustments)
router.get('/stock-adjustments/by-item', authUser, getStockAdjustmentsByItem)
router.get('/stock-adjustments/reasons', authUser, getStockAdjustmentsReasons)

// Supplier reports
router.get('/suppliers', authUser, getSupplierSummary)
router.get('/suppliers/top', authUser, getTopSuppliers)
router.get('/suppliers/:id', authUser, getSupplierPerformance)

// Profit reports
router.get('/profit', authUser, getProfitTotal)
router.get('/profit/by-item', authUser, getProfitByItem)
router.get('/profit/by-date', authUser, getProfitByDate)

module.exports = router
