const express = require('express');
const {
    createCustomer,
    getAllCustomers,
    getCustomer,
    searchCustomers,
    updateCustomer,
    deleteCustomer
} = require('../controllers/CustomerController');
const authUser = require('../middlewares/AuthUser');
const { requireAdmin } = require('../middlewares/AuthUser');

const router = express.Router();

// Create a new customer
router.post('/add', authUser, createCustomer);
router.post('/register', authUser, createCustomer);
router.post('/create-customer', authUser, createCustomer);
router.post('/create', authUser, createCustomer);

// Get all customers
router.get('/all', authUser, getAllCustomers);
router.get('/all-customers', authUser, getAllCustomers);
router.get('/all-profiles', authUser, getAllCustomers);
router.get('/get-all', authUser, getAllCustomers);

// Search customers
router.get('/search', authUser, searchCustomers);

// Delete customer (must come BEFORE /:id route to match properly)
router.delete('/delete/:id', authUser, requireAdmin, deleteCustomer);
router.delete('/remove/:id', authUser, requireAdmin, deleteCustomer);

// Update customer (must come BEFORE /:id route for PUT)
router.put('/update-customer/:id', authUser, updateCustomer);
router.put('/update/:id', authUser, updateCustomer);
router.put('/edit/:id', authUser, updateCustomer);

// Get a specific customer by ID (generic route last)
router.get('/:id', authUser, getCustomer);

// Update customer (generic route last)
router.put('/:id', authUser, updateCustomer);

// Delete customer (generic route last)
router.delete('/:id', authUser, requireAdmin, deleteCustomer);

module.exports = router;
