const express = require('express');
const authUser = require('../middlewares/AuthUser');
const {
	getDashboardOverview,
	getSalesTrend,
	getRecentSales,
	getLowStockItems,
	getPurchaseActivity,
	getLiveFeed,
} = require('../controllers/DashboardController');

const router = express.Router();

router.get('/overview', authUser, getDashboardOverview);
router.get('/sales-trend', authUser, getSalesTrend);
router.get('/recent-sales', authUser, getRecentSales);
router.get('/low-stock', authUser, getLowStockItems);
router.get('/purchase-activity', authUser, getPurchaseActivity);
router.get('/live-feed', authUser, getLiveFeed);


module.exports = router;