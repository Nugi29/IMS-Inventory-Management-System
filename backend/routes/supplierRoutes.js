const express = require('express');
const { createSupplier, getAllSuppliers, getSupplierById, getSupplierByName, updateSupplier, deleteSupplier } = require('../controllers/SupplierController');
const { createSupplier, getAllSuppliers, getSupplierById, getSupplierByName, updateSupplier, deleteSupplier } = require('../controllers/Supplier');
const authUser = require('../middlewares/AuthUser');

const router = express.Router();

router.post('/', authUser, authUser.requireAdmin, createSupplier);
router.get('/', authUser, getAllSuppliers);
router.get('/search/:name', authUser, getSupplierByName);
router.post('/create', authUser, authUser.requireAdmin, createSupplier);
router.get('/all', authUser, getAllSuppliers);
router.get('/:id', authUser, getSupplierById);
router.get('/search', authUser, getSupplierByName);
router.put('/update/:id', authUser, authUser.requireAdmin, updateSupplier);
router.delete('/delete/:id', authUser, authUser.requireAdmin, deleteSupplier);
router.put('/update-supplier/:id', authUser, authUser.requireAdmin, updateSupplier);
router.put('/:id', authUser, authUser.requireAdmin, updateSupplier);
router.delete('/delete-supplier/:id', authUser, authUser.requireAdmin, deleteSupplier);
router.get('/:id', authUser, getSupplierById);
router.put('/update-supplier/:id', authUser, authUser.requireAdmin, updateSupplier);
router.put('/:id', authUser, authUser.requireAdmin, updateSupplier);
router.delete('/delete-supplier/:id', authUser, authUser.requireAdmin, deleteSupplier);

module.exports = router;
