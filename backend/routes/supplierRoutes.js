const express = require('express');
const { createSupplier, getAllSuppliers, getSupplierById, getSupplierByName, updateSupplier, deleteSupplier } = require('../controllers/SupplierController');
const authUser = require('../middlewares/AuthUser');

const router = express.Router();

// Create supplier
router.post('/', authUser, authUser.requireAdmin, createSupplier);
router.post('/create', authUser, authUser.requireAdmin, createSupplier);

// List and search suppliers
router.get('/', authUser, getAllSuppliers);
router.get('/all', authUser, getAllSuppliers);
router.get('/search', authUser, getSupplierByName);
router.get('/search/:name', authUser, getSupplierByName);

// Update supplier
router.put('/update-supplier/:id', authUser, authUser.requireAdmin, updateSupplier);
router.put('/update/:id', authUser, authUser.requireAdmin, updateSupplier);
router.put('/:id', authUser, authUser.requireAdmin, updateSupplier);

// Delete supplier
router.delete('/delete/:id', authUser, authUser.requireAdmin, deleteSupplier);
router.delete('/delete-supplier/:id', authUser, authUser.requireAdmin, deleteSupplier);

// Supplier by id (keep generic routes last)
router.get('/:id', authUser, getSupplierById);
router.delete('/:id', authUser, authUser.requireAdmin, deleteSupplier);

module.exports = router;
