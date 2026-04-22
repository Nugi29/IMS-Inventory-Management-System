const { Op, col, where } = require('sequelize');
const { sequelize, models } = require('../config/db');

const {
	sale: Sale,
	item: Item,
	supplier: Supplier,
	grn: Grn,
	grn_item: GrnItem,
	grn_status: GrnStatus,
	sale_item: SaleItem,
	stock_movement: StockMovement,
	movement_type: MovementType,
	user: User,
} = models;

const DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const startOfDay = (date = new Date()) => {
	const value = new Date(date);
	value.setHours(0, 0, 0, 0);
	return value;
};

const endOfDay = (date = new Date()) => {
	const value = new Date(date);
	value.setHours(23, 59, 59, 999);
	return value;
};

const getLocalDateKey = (dateValue) => {
	const date = new Date(dateValue);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const formatTrendLabel = (dateValue) => {
	const date = new Date(dateValue);
	return date.toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	});
};

const normalizeStatusName = (statusName) => String(statusName || '').trim().toLowerCase();

const getSummary = async () => {
	const todayStart = startOfDay();
	const todayEnd = endOfDay();

	const [
		totalItems,
		totalSuppliers,
		todaySales,
		todayGrns,
		pendingGrnStatuses,
		lowStockItems,
		stockItems,
	] = await Promise.all([
		Item.count(),
		Supplier.count(),
		Sale.findAll({
			where: { sale_date: { [Op.between]: [todayStart, todayEnd] } },
			attributes: ['total_amount'],
		}),
		Grn.count({
			where: { grn_date: { [Op.between]: [todayStart, todayEnd] } },
		}),
		GrnStatus.findAll({ attributes: ['id', 'name'] }),
		Item.count({
			where: {
				[Op.and]: [where(col('quantity'), Op.lte, col('reorder_level'))],
			},
		}),
		Item.findAll({ attributes: ['quantity', 'selling_price'] }),
	]);

	const pendingStatusIds = pendingGrnStatuses
		.filter((status) => !['received', 'fully received', 'completed', 'cancelled', 'canceled'].includes(normalizeStatusName(status.name)))
		.map((status) => status.id);

	const pendingTodayGrns = pendingStatusIds.length
		? await Grn.count({
			where: {
				grn_date: { [Op.between]: [todayStart, todayEnd] },
				grn_status_id: { [Op.in]: pendingStatusIds },
			},
		})
		: 0;

	const todaySalesAmount = todaySales.reduce((sum, row) => sum + toNumber(row.total_amount), 0);
	const stockValue = stockItems.reduce(
		(sum, row) => sum + toNumber(row.quantity) * toNumber(row.selling_price),
		0,
	);

	return {
		total_sales_today: Number(todaySalesAmount.toFixed(2)),
		total_sales_count_today: todaySales.length,
		total_items: totalItems,
		total_suppliers: totalSuppliers,
		low_stock_count: lowStockItems,
		total_grn_today: todayGrns,
		pending_grn_today: pendingTodayGrns,
		total_stock_value: Number(stockValue.toFixed(2)),
	};
};

const getSalesTrendData = async () => {
	const today = startOfDay();
	const trendStart = new Date(today.getTime() - (6 * DAY_MS));
	const trendEnd = endOfDay(today);

	const rows = await Sale.findAll({
		where: {
			sale_date: { [Op.between]: [trendStart, trendEnd] },
		},
		attributes: ['sale_date', 'total_amount'],
		order: [['sale_date', 'ASC']],
	});

	const buckets = new Map();
	for (let i = 0; i < 7; i += 1) {
		const date = new Date(trendStart.getTime() + (i * DAY_MS));
		const key = getLocalDateKey(date);
		buckets.set(key, {
			date: key,
			label: formatTrendLabel(date),
			amount: 0,
		});
	}

	rows.forEach((row) => {
		const key = getLocalDateKey(row.sale_date);
		const current = buckets.get(key);
		if (current) {
			current.amount += toNumber(row.total_amount);
		}
	});

	return Array.from(buckets.values()).map((entry) => ({
		...entry,
		amount: Number(entry.amount.toFixed(2)),
	}));
};

const getRecentSalesData = async () => {
	const rows = await Sale.findAll({
		include: [{ model: SaleItem, as: 'sale_items' }],
		order: [['sale_date', 'DESC']],
		limit: 5,
	});

	return rows.map((row) => ({
		id: row.id,
		invoice_no: `INV-${String(row.id).padStart(4, '0')}`,
		sale_date: row.sale_date,
		payment_method: 'Sale',
		item_count: (row.sale_items || []).length,
		total_amount: toNumber(row.total_amount),
	}));
};

const getLowStockItemsData = async () => {
	const rows = await Item.findAll({
		where: {
			[Op.and]: [
				where(col('quantity'), Op.lte, col('reorder_level')),
			],
		},
		order: [[sequelize.literal('CASE WHEN quantity <= 0 THEN 0 ELSE 1 END'), 'ASC'], ['quantity', 'ASC']],
		limit: 5,
	});

	return rows.map((row) => {
		const quantity = toNumber(row.quantity);
		const reorderLevel = toNumber(row.reorder_level) || 1;
		const levelPercent = Math.max(0, Math.min(100, Math.round((quantity / reorderLevel) * 100)));

		return {
			id: row.id,
			item_name: row.name,
			quantity,
			reorder_level: reorderLevel,
			level_percent: levelPercent,
			is_out_of_stock: quantity <= 0,
		};
	});
};

const getPurchaseActivityData = async () => {
	const rows = await Grn.findAll({
		include: [
			{ model: Supplier, as: 'supplier', attributes: ['id', 'name'] },
			{ model: GrnStatus, as: 'grn_status', attributes: ['id', 'name'] },
			{ model: GrnItem, as: 'grn_items', attributes: ['total_quantity', 'recieved_quantity'] },
		],
		order: [['grn_date', 'DESC']],
		limit: 5,
	});

	return rows.map((row) => {
		const receivedUnits = (row.grn_items || []).reduce((sum, grnItem) => {
			const quantityValue = grnItem.received_quantity
				?? grnItem.recieved_quantity
				?? grnItem.total_quantity
				?? grnItem.quantity
				?? 0;

			return sum + toNumber(quantityValue);
		}, 0);

		return {
			id: row.id,
			grn_no: `GRN-${new Date(row.grn_date || Date.now()).getFullYear()}-${String(row.id).padStart(3, '0')}`,
			supplier_name: row.supplier?.name || 'N/A',
			items_received: receivedUnits,
			status_name: row.grn_status?.name || 'Pending',
			total_amount: Number(toNumber(row.total_amount).toFixed(2)),
			grn_date: row.grn_date,
		};
	});
};

const getLiveFeedData = async () => {
	const rows = await StockMovement.findAll({
		include: [
			{ model: Item, as: 'item', attributes: ['id', 'name'] },
			{ model: User, as: 'user', attributes: ['id', 'name'] },
			{ model: MovementType, as: 'movement_type', attributes: ['id', 'name'] },
		],
		order: [['id', 'DESC']],
		limit: 6,
	});

	return rows.map((row) => ({
		id: row.id,
		title: `${row.movement_type?.name || 'Stock Movement'}: ${row.item?.name || 'Item'}`,
		description: `${toNumber(row.quantity)} units`,
		actor: row.user?.name || 'System',
		movement_type: row.movement_type?.name || 'Stock',
	}));
};

const getDashboardOverview = async (req, res) => {
	try {
		const [summary, salesTrend, recentSales, lowStockItems, purchaseActivity, liveFeed] = await Promise.all([
			getSummary(),
			getSalesTrendData(),
			getRecentSalesData(),
			getLowStockItemsData(),
			getPurchaseActivityData(),
			getLiveFeedData(),
		]);

		return res.json({
			success: true,
			dashboardData: {
				summary,
				salesTrend,
				recentSales,
				lowStockItems,
				purchaseActivity,
				liveFeed,
			},
		});
	} catch (error) {
		console.error('Error loading dashboard overview:', error);
		return res.status(500).json({ success: false, message: error.message });
	}
};

const getSalesTrend = async (req, res) => {
	try {
		const salesTrend = await getSalesTrendData();
		return res.json({ success: true, salesTrend });
	} catch (error) {
		console.error('Error loading sales trend:', error);
		return res.status(500).json({ success: false, message: error.message });
	}
};

const getRecentSales = async (req, res) => {
	try {
		const recentSales = await getRecentSalesData();
		return res.json({ success: true, recentSales });
	} catch (error) {
		console.error('Error loading recent sales:', error);
		return res.status(500).json({ success: false, message: error.message });
	}
};

const getLowStockItems = async (req, res) => {
	try {
		const lowStockItems = await getLowStockItemsData();
		return res.json({ success: true, lowStockItems });
	} catch (error) {
		console.error('Error loading low stock items:', error);
		return res.status(500).json({ success: false, message: error.message });
	}
};

const getPurchaseActivity = async (req, res) => {
	try {
		const purchaseActivity = await getPurchaseActivityData();
		return res.json({ success: true, purchaseActivity });
	} catch (error) {
		console.error('Error loading purchase activity:', error);
		return res.status(500).json({ success: false, message: error.message });
	}
};

const getLiveFeed = async (req, res) => {
	try {
		const liveFeed = await getLiveFeedData();
		return res.json({ success: true, liveFeed });
	} catch (error) {
		console.error('Error loading live feed:', error);
		return res.status(500).json({ success: false, message: error.message });
	}
};

module.exports = {
	getDashboardOverview,
	getSalesTrend,
	getRecentSales,
	getLowStockItems,
	getPurchaseActivity,
	getLiveFeed,
};
