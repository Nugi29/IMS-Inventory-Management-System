const express = require('express');
const authUser = require('../middlewares/AuthUser');
const {
    createStockAdjustment,
    getStockAdjustments,
} = require('../controllers/StockAdjustmentController');

const router = express.Router();

// Minimal APIs for stock adjustment module
router.post('/', authUser, createStockAdjustment);
router.post('/create', authUser, createStockAdjustment);
router.get('/', authUser, getStockAdjustments);
router.get('/list', authUser, getStockAdjustments);

module.exports = router;
