const express = require('express');
const {
    createSale,
    getAllSales,
    getSale,
    getSalesByCustomer,
    getSalesByDateRange,
    getSalesReport
} = require('../controllers/SalesController');
const authUser = require('../middlewares/AuthUser');

const router = express.Router();

// Create a new sale
router.post('/create', authUser, createSale);

// Get all sales
router.get('/all', authUser, getAllSales);

// Get sales report
router.get('/report', authUser, getSalesReport);

// Get sales by date range
router.get('/date-range', authUser, getSalesByDateRange);

// Get sales by customer
router.get('/customer/:customerId', authUser, getSalesByCustomer);

// Get a specific sale by ID
router.get('/:id', authUser, getSale);

module.exports = router;
