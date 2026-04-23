const express = require('express');
const authUser = require('../middlewares/AuthUser');
const {
	getDashboardOverview,
	getSalesTrend,
	getRecentSales,
	getLowStockItems,
	getPurchaseActivity,
	getLiveFeed,
	getCashierDashboard,
	getStorekeeperDashboard,
	getManagerDashboard,
	getAdminDashboard,
} = require('../controllers/DashboardController');

const router = express.Router();

router.get('/overview', authUser, getDashboardOverview);
router.get('/sales-trend', authUser, getSalesTrend);
router.get('/recent-sales', authUser, getRecentSales);
router.get('/low-stock', authUser, getLowStockItems);
router.get('/purchase-activity', authUser, getPurchaseActivity);
router.get('/live-feed', authUser, getLiveFeed);

// Role-based dashboards
router.get('/cashier-insights', authUser, getCashierDashboard);
router.get('/storekeeper-insights', authUser, getStorekeeperDashboard);
router.get('/manager-insights', authUser, getManagerDashboard);
router.get('/admin-insights', authUser, getAdminDashboard);

module.exports = router;