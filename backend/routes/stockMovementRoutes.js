const express = require('express');
const authUser = require('../middlewares/AuthUser');
const {
    createStockMovement,
    getStockMovements,
} = require('../controllers/StockMovementController');

const router = express.Router();

// Minimal APIs for stock movement module
router.post('/', authUser, createStockMovement);
router.get('/', authUser, getStockMovements);
router.get('/list', authUser, getStockMovements);
router.get('/all', authUser, getStockMovements);

module.exports = router;
