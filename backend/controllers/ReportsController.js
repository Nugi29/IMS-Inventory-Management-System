const { Op, fn, col, literal, where } = require('sequelize')
const { sequelize, models } = require('../config/db')
const { getDashboardOverview } = require('./DashboardController')
const item = require('../models/item')

const {
    sale: Sale,
    sale_item: SaleItem,
    item: Item,
    supplier: Supplier,
    supplier_status: SupplierStatus,
    grn: Grn,
    grn_item: GrnItem,
    purchase_order: PurchaseOrder,
    purchase_order_item: PurchaseOrderItem,
    po_status: PoStatus,
    grn_status: GrnStatus,
    stock_movement: StockMovement,
    movement_type: MovementType,
    stock_adjustment: StockAdjustment,
    user: User,
} = models

const DAY_MS = 24 * 60 * 60 * 1000

const toNumber = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

const parseDate = (value) => {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

const buildDateRange = (startDate, endDate, defaultDays = 30) => {
    const now = new Date()
    let start = parseDate(startDate)
    let end = parseDate(endDate)

    if (!end) {
        end = new Date(now)
    }

    if (!start) {
        start = new Date(end.getTime() - defaultDays * DAY_MS)
    }

    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return { start, end }
}

const formatDateKey = (value) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString().split('T')[0]
}

const formatMonthKey = (value) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const getSummary = async (req, res) => {
    try {
        const [salesTotalResult, purchaseTotalResult, totalOrders, totalSuppliers, lowStockCount, stockItems] = await Promise.all([
            Sale.findAll({ attributes: [[fn('SUM', col('total_amount')), 'total_sales']] }),
            Grn.findAll({ attributes: [[fn('SUM', col('total_amount')), 'total_purchases']] }),
            Sale.count(),
            Supplier.count(),
            Item.count({ where: { [Op.and]: [where(col('quantity'), Op.lte, col('reorder_level'))] } }),
            Item.findAll({ attributes: ['quantity', 'selling_price'] }),
        ])

        const totalSales = toNumber(salesTotalResult[0]?.dataValues?.total_sales)
        const totalPurchases = toNumber(purchaseTotalResult[0]?.dataValues?.total_purchases)
        const totalProfit = Number((totalSales - totalPurchases).toFixed(2))
        const totalStockValue = stockItems.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.selling_price), 0)

        return res.json({
            success: true,
            summary: {
                totalSales,
                totalPurchases,
                totalProfit,
                lowStock: lowStockCount,
                totalOrders,
                totalSuppliers,
                totalStockValue: Number(totalStockValue.toFixed(2)),
            },
        })
    } catch (error) {
        console.error('Error loading reports summary:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getDashboard = async (req, res) => getDashboardOverview(req, res)

const getSales = async (req, res) => {
    try {
        const { startDate, endDate } = req.query
        const { start, end } = buildDateRange(startDate, endDate, 30)
        const rows = await Sale.findAll({
            where: { sale_date: { [Op.between]: [start, end] } },
            include: [
                { model: User, as: 'user', attributes: ['id', 'name'] },
            ],
            order: [['sale_date', 'DESC']],
        })

        const sales = rows.map((sale) => ({
            id: sale.id,
            sale_date: sale.sale_date,
            invoice_id: `INV-${String(sale.id).padStart(4, '0')}`,
            cashier: sale.user?.name || 'Unknown',
            total_amount: toNumber(sale.total_amount),
        }))

        return res.json({ success: true, sales })
    } catch (error) {
        console.error('Error loading sales report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getSalesDaily = async (req, res) => {
    try {
        const { startDate, endDate } = req.query
        const { start, end } = buildDateRange(startDate, endDate, 30)
        const rows = await Sale.findAll({
            where: { sale_date: { [Op.between]: [start, end] } },
            attributes: [
                [fn('DATE', col('sale_date')), 'date'],
                [fn('SUM', col('total_amount')), 'total_amount'],
                [fn('COUNT', col('id')), 'count'],
            ],
            group: [literal('DATE(sale_date)')],
            order: [[literal('DATE(sale_date)'), 'ASC']],
            raw: true,
        })

        return res.json({
            success: true,
            daily: rows.map((row) => ({
                date: formatDateKey(row.date),
                total_amount: Number(toNumber(row.total_amount).toFixed(2)),
                count: toNumber(row.count),
            })),
        })
    } catch (error) {
        console.error('Error loading daily sales report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getSalesMonthly = async (req, res) => {
    try {
        const { startDate, endDate } = req.query
        const { start, end } = buildDateRange(startDate, endDate, 180)
        const rows = await Sale.findAll({
            where: { sale_date: { [Op.between]: [start, end] } },
            attributes: [
                [fn('DATE_FORMAT', col('sale_date'), '%Y-%m'), 'month'],
                [fn('SUM', col('total_amount')), 'total_amount'],
                [fn('COUNT', col('id')), 'count'],
            ],
            group: [literal("DATE_FORMAT(sale_date, '%Y-%m')")],
            order: [[literal("DATE_FORMAT(sale_date, '%Y-%m')"), 'ASC']],
            raw: true,
        })

        return res.json({
            success: true,
            monthly: rows.map((row) => ({
                month: row.month,
                total_amount: Number(toNumber(row.total_amount).toFixed(2)),
                count: toNumber(row.count),
            })),
        })
    } catch (error) {
        console.error('Error loading monthly sales report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getSalesByItem = async (req, res) => {
    try {
        const rows = await SaleItem.findAll({
            include: [{ model: Item, as: 'item', attributes: ['id', 'name'] }],
            attributes: [
                'item_id',
                [fn('SUM', literal('sale_item.quantity * sale_item.selling_price')), 'revenue'],
                [fn('SUM', col('sale_item.quantity')), 'quantity'],
            ],
            group: ['item_id'],
            order: [[literal('revenue'), 'DESC']],
            raw: true,
        })

        return res.json({
            success: true,
            byItem: rows.map((row) => ({
                item_id: row.item_id,
                item_name: row['item.name'] || 'Unknown',
                revenue: Number(toNumber(row.revenue).toFixed(2)),
                quantity: toNumber(row.quantity),
            })),
        })
    } catch (error) {
        console.error('Error loading sales by item:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getSalesByCashier = async (req, res) => {
    try {
        const rows = await Sale.findAll({
            include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
            attributes: [
                'user_id',
                [fn('COUNT', col('sale.id')), 'transactions'],
                [fn('SUM', col('total_amount')), 'total_amount'],
            ],
            group: ['user_id'],
            order: [[literal('total_amount'), 'DESC']],
            raw: true,
        })

        return res.json({
            success: true,
            byCashier: rows.map((row) => ({
                user_id: row.user_id,
                cashier: row['user.name'] || 'Unknown',
                transactions: toNumber(row.transactions),
                total_amount: Number(toNumber(row.total_amount).toFixed(2)),
            })),
        })
    } catch (error) {
        console.error('Error loading sales by cashier:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getTopSellingItems = async (req, res) => {
    try {
        const rows = await SaleItem.findAll({
            include: [{ model: Item, as: 'item', attributes: ['id', 'name'] }],
            attributes: [
                'item_id',
                [fn('SUM', literal('sale_item.quantity * sale_item.selling_price')), 'revenue'],
                [fn('SUM', col('sale_item.quantity')), 'quantity'],
            ],
            group: ['item_id'],
            order: [[literal('revenue'), 'DESC']],
            limit: 10,
            raw: true,
        })

        return res.json({
            success: true,
            topItems: rows.map((row) => ({
                item_id: row.item_id,
                item_name: row['item.name'] || 'Unknown',
                revenue: Number(toNumber(row.revenue).toFixed(2)),
                quantity: toNumber(row.quantity),
            })),
        })
    } catch (error) {
        console.error('Error loading top selling items:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getInventory = async (req, res) => {
    try {
        const rows = await Item.findAll({
            include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name'] }],
            order: [['quantity', 'DESC']],
        })

        return res.json({
            success: true,
            inventory: rows.map((item) => ({
                item_id: item.id,
                name: item.name,
                code: item.code,
                quantity: toNumber(item.quantity),
                reorder_level: toNumber(item.reorder_level),
                supplier: item.supplier?.name || null,
            })),
        })
    } catch (error) {
        console.error('Error loading inventory report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getInventoryValue = async (req, res) => {
    try {
        const averages = await GrnItem.findAll({
            attributes: ['item_id', [fn('AVG', col('purchase_price')), 'avg_purchase_price']],
            group: ['item_id'],
            raw: true,
        })

        const priceMap = averages.reduce((map, row) => {
            map[row.item_id] = toNumber(row.avg_purchase_price)
            return map
        }, {})

        const items = await Item.findAll({ attributes: ['id', 'name', 'quantity', 'selling_price'] })
        const itemValues = items.map((item) => {
            const quantity = toNumber(item.quantity)
            const purchasePrice = priceMap[item.id] || toNumber(item.selling_price)
            return {
                item_id: item.id,
                item_name: item.name,
                quantity,
                unit_price: purchasePrice,
                value: Number((quantity * purchasePrice).toFixed(2)),
            }
        })

        const totalValue = itemValues.reduce((sum, item) => sum + item.value, 0)

        return res.json({ success: true, total_value: Number(totalValue.toFixed(2)), itemValues })
    } catch (error) {
        console.error('Error loading inventory value report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getLowStock = async (req, res) => {
    try {
        const rows = await Item.findAll({
            where: { [Op.and]: [where(col('quantity'), Op.lte, col('reorder_level'))] },
            order: [['quantity', 'ASC']],
        })

        return res.json({
            success: true,
            lowStock: rows.map((item) => ({
                item_id: item.id,
                name: item.name,
                quantity: toNumber(item.quantity),
                reorder_level: toNumber(item.reorder_level),
            })),
        })
    } catch (error) {
        console.error('Error loading low stock report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getOutOfStock = async (req, res) => {
    try {
        const rows = await Item.findAll({
            where: { quantity: { [Op.lte]: 0 } },
            order: [['name', 'ASC']],
        })

        return res.json({
            success: true,
            outOfStock: rows.map((item) => ({
                item_id: item.id,
                name: item.name,
                quantity: toNumber(item.quantity),
            })),
        })
    } catch (error) {
        console.error('Error loading out of stock report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getGrnHistory = async (req, res) => {
    try {
        const rows = await Grn.findAll({
            include: [
                { model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
                { model: GrnStatus, as: 'grn_status', attributes: ['id', 'name'] },
            ],
            order: [['grn_date', 'DESC']],
            limit: 100,
        })

        return res.json({
            success: true,
            grnHistory: rows.map((row) => ({
                grn_id: row.id,
                grn_date: row.grn_date,
                supplier: row.supplier?.name || 'Unknown',
                total_amount: toNumber(row.total_amount),
                status: row.grn_status?.name || 'Unknown',
            })),
        })
    } catch (error) {
        console.error('Error loading GRN history report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getGrnBySupplier = async (req, res) => {
  try {
    const rows = await Grn.findAll({
      include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name'] }],
      attributes: [
        'supplier_id',
        [fn('COUNT', col('grn.id')), 'grn_count'],
        [fn('SUM', col('total_amount')), 'total_amount'],
      ],
      group: ['supplier_id'],
      order: [[literal('total_amount'), 'DESC']],
      raw: true,
    })

    return res.json({
      success: true,
      bySupplier: rows.map((row) => ({
        supplier_id: row.supplier_id,
        supplier: row['supplier.name'] || 'Unknown',
        grn_count: toNumber(row.grn_count),
        total_amount: Number(toNumber(row.total_amount).toFixed(2)),
      })),
    })
  } catch (error) {
    console.error('Error loading GRN by supplier report:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

const getGrnDaily = async (req, res) => {
    try {
        const { startDate, endDate } = req.query
        const { start, end } = buildDateRange(startDate, endDate, 30)
        const rows = await Grn.findAll({
            where: { grn_date: { [Op.between]: [start, end] } },
            attributes: [
                [fn('DATE', col('grn_date')), 'date'],
                [fn('SUM', col('total_amount')), 'total_amount'],
                [fn('COUNT', col('id')), 'count'],
            ],
            group: [literal('DATE(grn_date)')],
            order: [[literal('DATE(grn_date)'), 'ASC']],
            raw: true,
        })

        return res.json({
            success: true,
            daily: rows.map((row) => ({
                date: formatDateKey(row.date),
                total_amount: Number(toNumber(row.total_amount).toFixed(2)),
                count: toNumber(row.count),
            })),
        })
    } catch (error) {
        console.error('Error loading GRN daily report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getGrnMonthly = async (req, res) => {
    try {
        const { startDate, endDate } = req.query
        const { start, end } = buildDateRange(startDate, endDate, 180)
        const rows = await Grn.findAll({
            where: { grn_date: { [Op.between]: [start, end] } },
            attributes: [
                [fn('DATE_FORMAT', col('grn_date'), '%Y-%m'), 'month'],
                [fn('SUM', col('total_amount')), 'total_amount'],
                [fn('COUNT', col('id')), 'count'],
            ],
            group: [literal("DATE_FORMAT(grn_date, '%Y-%m')")],
            order: [[literal("DATE_FORMAT(grn_date, '%Y-%m')"), 'ASC']],
            raw: true,
        })

        return res.json({
            success: true,
            monthly: rows.map((row) => ({
                month: row.month,
                total_amount: Number(toNumber(row.total_amount).toFixed(2)),
                count: toNumber(row.count),
            })),
        })
    } catch (error) {
        console.error('Error loading GRN monthly report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getPurchaseOrders = async (req, res) => {
    try {
        const rows = await PurchaseOrder.findAll({
            include: [
                { model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
                { model: PoStatus, as: 'po_status', attributes: ['id', 'name'] },
            ],
            order: [['order_date', 'DESC']],
            limit: 100,
        })

        return res.json({
            success: true,
            purchaseOrders: rows.map((row) => ({
                po_id: row.id,
                order_date: row.order_date,
                supplier: row.supplier?.name || 'Unknown',
                total_amount: toNumber(row.total_amount),
                status: row.po_status?.name || 'Unknown',
            })),
        })
    } catch (error) {
        console.error('Error loading purchase orders report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getPurchaseOrdersByStatus = async (req, res) => {
  try {
    const rows = await PurchaseOrder.findAll({
      include: [{ model: PoStatus, as: 'po_status', attributes: ['name'] }],
      attributes: [
        'po_status_id',
        [fn('COUNT', col('purchase_order.id')), 'count'],
        [fn('SUM', col('total_amount')), 'total_amount'],
      ],
      group: ['po_status_id'],
      order: [[literal('total_amount'), 'DESC']],
      raw: true,
    })

        return res.json({
            success: true,
            byStatus: rows.map((row) => ({
                status: row['po_status.name'] || 'Unknown',
                count: toNumber(row.count),
                total_amount: Number(toNumber(row.total_amount).toFixed(2)),
            })),
        })
    } catch (error) {
        console.error('Error loading purchase orders by status report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const isCompletedStatus = (name) => String(name || '').trim().toLowerCase() === 'completed'

const getPurchaseOrdersPending = async (req, res) => {
    try {
        const rows = await PurchaseOrder.findAll({
            include: [
                { model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
                { model: PoStatus, as: 'po_status', attributes: ['id', 'name'], where: { [Op.and]: [sequelize.where(fn('LOWER', col('po_status.name')), { [Op.notLike]: '%completed%' })] } },
            ],
            order: [['order_date', 'DESC']],
            limit: 100,
        })

        return res.json({
            success: true,
            pending: rows.map((row) => ({
                po_id: row.id,
                order_date: row.order_date,
                supplier: row.supplier?.name || 'Unknown',
                total_amount: toNumber(row.total_amount),
                status: row.po_status?.name || 'Unknown',
            })),
        })
    } catch (error) {
        console.error('Error loading pending purchase orders report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getPurchaseOrdersCompleted = async (req, res) => {
    try {
        const rows = await PurchaseOrder.findAll({
            include: [
                { model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
                { model: PoStatus, as: 'po_status', attributes: ['id', 'name'], where: sequelize.where(fn('LOWER', col('po_status.name')), 'completed') },
            ],
            order: [['order_date', 'DESC']],
            limit: 100,
        })

        return res.json({
            success: true,
            completed: rows.map((row) => ({
                po_id: row.id,
                order_date: row.order_date,
                supplier: row.supplier?.name || 'Unknown',
                total_amount: toNumber(row.total_amount),
                status: row.po_status?.name || 'Unknown',
            })),
        })
    } catch (error) {
        console.error('Error loading completed purchase orders report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getStockMovementHistory = async (req, res) => {
    try {
        const rows = await StockMovement.findAll({
            include: [
                { model: Item, as: 'item', attributes: ['id', 'name'] },
                { model: MovementType, as: 'movement_type', attributes: ['id', 'name'] },
                { model: User, as: 'user', attributes: ['id', 'name'] },
            ],
            order: [['createdAt', 'DESC']],
            limit: 200,
        })

        return res.json({
            success: true,
            movements: rows.map((row) => ({
                id: row.id,
                item: row.item?.name || 'Unknown',
                quantity: toNumber(row.quantity),
                type: row.movement_type?.name || 'Unknown',
                user: row.user?.name || 'System',
                createdAt: row.createdAt,
            })),
        })
    } catch (error) {
        console.error('Error loading stock movement report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getStockMovementByItem = async (req, res) => {
  try {
    const rows = await StockMovement.findAll({
      include: [{ model: Item, as: 'item', attributes: ['id', 'name'] }],
      attributes: [
        'item_id',
        [fn('SUM', col('stock_movement.quantity')), 'quantity'],
        [fn('COUNT', col('stock_movement.id')), 'movements'],
      ],
      group: ['item_id'],
      order: [[literal('quantity'), 'DESC']],
      raw: true,
    })

        return res.json({
            success: true,
            byItem: rows.map((row) => ({
                item_id: row.item_id,
                item: row['item.name'] || 'Unknown',
                quantity: toNumber(row.quantity),
                movements: toNumber(row.movements),
            })),
        })
    } catch (error) {
        console.error('Error loading stock movement by item report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getStockMovementByType = async (req, res) => {
  try {
    const rows = await StockMovement.findAll({
      include: [{ model: MovementType, as: 'movement_type', attributes: ['id', 'name'] }],
      attributes: [
        'movement_type_id',
        [fn('SUM', col('quantity')), 'quantity'],
        [fn('COUNT', col('stock_movement.id')), 'movements'],
      ],
      group: ['movement_type_id'],
      order: [[literal('quantity'), 'DESC']],
      raw: true,
    })

        return res.json({
            success: true,
            byType: rows.map((row) => ({
                movement_type_id: row.movement_type_id,
                type: row['movement_type.name'] || 'Unknown',
                quantity: toNumber(row.quantity),
                movements: toNumber(row.movements),
            })),
        })
    } catch (error) {
        console.error('Error loading stock movement by type report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getStockMovementSummary = async (req, res) => {
  try {
    const rows = await StockMovement.findAll({
      include: [{ model: MovementType, as: 'movement_type', attributes: ['name'] }],
      attributes: [
        'movement_type_id',
        [fn('SUM', col('quantity')), 'total_quantity'],
        [fn('COUNT', col('stock_movement.id')), 'movement_count'],
      ],
      group: ['movement_type_id'],
      raw: true,
    })

        const totals = rows.map((row) => ({
            type: row['movement_type.name'] || 'Unknown',
            total_quantity: toNumber(row.total_quantity),
            movement_count: toNumber(row.movement_count),
        }))

        const totalMovements = totals.reduce((sum, row) => sum + row.movement_count, 0)
        const totalQuantity = totals.reduce((sum, row) => sum + row.total_quantity, 0)

        return res.json({
            success: true,
            summary: {
                totalMovements,
                totalQuantity,
                breakdown: totals,
            },
        })
    } catch (error) {
        console.error('Error loading stock movement summary report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getStockAdjustments = async (req, res) => {
    try {
        const rows = await StockAdjustment.findAll({
            include: [
                { model: Item, as: 'item', attributes: ['id', 'name'] },
                { model: User, as: 'user', attributes: ['id', 'name'] },
            ],
            order: [['id', 'DESC']],
            limit: 100,
        })

        return res.json({
            success: true,
            adjustments: rows.map((row) => ({
                adjustment_id: row.id,
                item: row.item?.name || 'Unknown',
                quantity: toNumber(row.quantity),
                reason: row.reason || 'Unspecified',
                user: row.user?.name || 'System',
            })),
        })
    } catch (error) {
        console.error('Error loading stock adjustments report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getStockAdjustmentsByItem = async (req, res) => {
  try {
    const rows = await StockAdjustment.findAll({
      include: [{ model: Item, as: 'item', attributes: ['id', 'name'] }],
      attributes: [
        'item_id',
        [fn('SUM', col('stock_adjustment.quantity')), 'quantity'],
        [fn('COUNT', col('stock_adjustment.id')), 'adjustments'],
      ],
      group: ['item_id'],
      order: [[literal('quantity'), 'DESC']],
      raw: true,
    })

        return res.json({
            success: true,
            byItem: rows.map((row) => ({
                item_id: row.item_id,
                item: row['item.name'] || 'Unknown',
                quantity: toNumber(row.quantity),
                adjustments: toNumber(row.adjustments),
            })),
        })
    } catch (error) {
        console.error('Error loading stock adjustments by item report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getStockAdjustmentsReasons = async (req, res) => {
  try {
    const rows = await StockAdjustment.findAll({
      include: [{ model: Item, as: 'item', attributes: ['id', 'name'] }],
      attributes: [
        'reason',
        'item_id',
        [fn('SUM', col('stock_adjustment.quantity')), 'quantity'],
        [fn('COUNT', col('stock_adjustment.id')), 'adjustments'],
      ],
      group: ['reason', 'item_id'],
      order: [[literal('quantity'), 'DESC']],
      raw: true,
    })

    return res.json({
      success: true,
      byReason: rows.map((row) => ({
        reason: row.reason || 'Unspecified',
        quantity: toNumber(row.quantity),
        item_name: row['item.name'] || 'Unknown',
        adjustments: toNumber(row.adjustments),
      })),
    })
  } catch (error) {
    console.error('Error loading stock adjustments reasons report:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

const getSupplierSummary = async (req, res) => {
    try {
        const rows = await Supplier.findAll({
            include: [{ model: SupplierStatus, as: 'supplier_status', attributes: ['name'] }],
            attributes: ['id', 'name'],
            order: [['name', 'ASC']],
        })

        const summary = rows.reduce(
            (acc, supplier) => {
                const status = supplier.supplier_status?.name || 'Unknown'
                acc.byStatus[status] = (acc.byStatus[status] || 0) + 1
                return acc
            },
            { totalSuppliers: rows.length, byStatus: {} }
        )

        return res.json({ success: true, summary })
    } catch (error) {
        console.error('Error loading supplier summary report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getTopSuppliers = async (req, res) => {
  try {
    const rows = await Grn.findAll({
      include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name'] }],
      attributes: [
        'supplier_id',
        [fn('COUNT', col('grn.id')), 'grn_count'],
        [fn('SUM', col('total_amount')), 'total_amount'],
      ],
      group: ['supplier_id'],
      order: [[literal('total_amount'), 'DESC']],
      limit: 10,
      raw: true,
    })

        return res.json({
            success: true,
            topSuppliers: rows.map((row) => ({
                supplier_id: row.supplier_id,
                supplier: row['supplier.name'] || 'Unknown',
                grn_count: toNumber(row.grn_count),
                total_amount: Number(toNumber(row.total_amount).toFixed(2)),
            })),
        })
    } catch (error) {
        console.error('Error loading top suppliers report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getSupplierPerformance = async (req, res) => {
    try {
        const supplierId = Number(req.params.id)
        if (!supplierId) {
            return res.status(400).json({ success: false, message: 'Supplier id is required' })
        }

        const supplier = await Supplier.findByPk(supplierId, {
            include: [{ model: SupplierStatus, as: 'supplier_status', attributes: ['name'] }],
        })

        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' })
        }

        const [grnRows, poRows] = await Promise.all([
            Grn.findAll({
                where: { supplier_id: supplierId },
                attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('total_amount')), 'total_amount']],
                raw: true,
            }),
            PurchaseOrder.findAll({
                where: { supplier_id: supplierId },
                attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('total_amount')), 'total_amount']],
                raw: true,
            }),
        ])

        return res.json({
            success: true,
            supplier: {
                id: supplier.id,
                name: supplier.name,
                status: supplier.supplier_status?.name || 'Unknown',
                grn_count: toNumber(grnRows[0]?.count),
                grn_total: Number(toNumber(grnRows[0]?.total_amount).toFixed(2)),
                po_count: toNumber(poRows[0]?.count),
                po_total: Number(toNumber(poRows[0]?.total_amount).toFixed(2)),
            },
        })
    } catch (error) {
        console.error('Error loading supplier performance report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getProfitTotal = async (req, res) => {
    try {
        const { startDate, endDate } = req.query
        const { start, end } = buildDateRange(startDate, endDate, 30)
        const [salesTotalResult, purchaseTotalResult] = await Promise.all([
            Sale.findAll({
                where: { sale_date: { [Op.between]: [start, end] } },
                attributes: [[fn('SUM', col('total_amount')), 'total_sales']],
                raw: true,
            }),
            Grn.findAll({
                where: { grn_date: { [Op.between]: [start, end] } },
                attributes: [[fn('SUM', col('total_amount')), 'total_purchases']],
                raw: true,
            }),
        ])

        const totalSales = toNumber(salesTotalResult[0]?.total_sales)
        const totalPurchases = toNumber(purchaseTotalResult[0]?.total_purchases)
        const profit = Number((totalSales - totalPurchases).toFixed(2))

        return res.json({ success: true, totalSales, totalPurchases, profit })
    } catch (error) {
        console.error('Error loading profit report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getProfitByItem = async (req, res) => {
    try {
        const averages = await GrnItem.findAll({
            attributes: ['item_id', [fn('AVG', col('purchase_price')), 'avg_purchase_price']],
            group: ['item_id'],
            raw: true,
        })
        const priceMap = averages.reduce((map, row) => {
            map[row.item_id] = toNumber(row.avg_purchase_price)
            return map
        }, {})

        const rows = await SaleItem.findAll({
            include: [{ model: Item, as: 'item', attributes: ['id', 'name'] }],
            attributes: [
                'item_id',
                [fn('SUM', literal('sale_item.quantity * sale_item.selling_price')), 'revenue'],
                [fn('SUM', col('sale_item.quantity')), 'quantity'],
            ],
            group: ['item_id'],
            order: [[literal('revenue'), 'DESC']],
            raw: true,
        })

        return res.json({
            success: true,
            byItem: rows.map((row) => {
                const itemId = row.item_id
                const marginPrice = priceMap[itemId] || 0
                const quantity = toNumber(row.quantity)
                const revenue = toNumber(row.revenue)
                const cost = Number((marginPrice * quantity).toFixed(2))
                return {
                    item_id: itemId,
                    item_name: row['item.name'] || 'Unknown',
                    quantity,
                    revenue: Number(revenue.toFixed(2)),
                    estimated_cost: cost,
                    profit: Number((revenue - cost).toFixed(2)),
                }
            }),
        })
    } catch (error) {
        console.error('Error loading profit by item report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const getProfitByDate = async (req, res) => {
    try {
        const { startDate, endDate } = req.query
        const { start, end } = buildDateRange(startDate, endDate, 30)

        const [salesRows, purchaseRows] = await Promise.all([
            Sale.findAll({
                where: { sale_date: { [Op.between]: [start, end] } },
                attributes: [
                    [fn('DATE', col('sale_date')), 'date'],
                    [fn('SUM', col('total_amount')), 'total_sales'],
                ],
                group: [literal('DATE(sale_date)')],
                order: [[literal('DATE(sale_date)'), 'ASC']],
                raw: true,
            }),
            Grn.findAll({
                where: { grn_date: { [Op.between]: [start, end] } },
                attributes: [
                    [fn('DATE', col('grn_date')), 'date'],
                    [fn('SUM', col('total_amount')), 'total_purchases'],
                ],
                group: [literal('DATE(grn_date)')],
                order: [[literal('DATE(grn_date)'), 'ASC']],
                raw: true,
            }),
        ])

        const map = new Map()
        salesRows.forEach((row) => {
            const key = formatDateKey(row.date)
            map.set(key, { date: key, totalSales: toNumber(row.total_sales), totalPurchases: 0 })
        })
        purchaseRows.forEach((row) => {
            const key = formatDateKey(row.date)
            const existing = map.get(key) || { date: key, totalSales: 0, totalPurchases: 0 }
            existing.totalPurchases = toNumber(row.total_purchases)
            map.set(key, existing)
        })

        const values = Array.from(map.values()).map((row) => ({
            date: row.date,
            total_sales: Number(row.totalSales.toFixed(2)),
            total_purchases: Number(row.totalPurchases.toFixed(2)),
            profit: Number((row.totalSales - row.totalPurchases).toFixed(2)),
        }))

        return res.json({ success: true, byDate: values })
    } catch (error) {
        console.error('Error loading profit by date report:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

module.exports = {
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
}

