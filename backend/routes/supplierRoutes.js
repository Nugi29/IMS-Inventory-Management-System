const express = require('express');
const { createSupplier, getAllSuppliers, getSupplierById, getSupplierByName, updateSupplier, deleteSupplier } = require('../controllers/Supplier');
const authUser = require('../middlewares/AuthUser');

const router = express.Router();

router.post('/create', authUser, authUser.requireAdmin, createSupplier);
router.get('/all', authUser, getAllSuppliers);
router.get('/:id', authUser, getSupplierById);
router.get('/search', authUser, getSupplierByName);
router.put('/update/:id', authUser, authUser.requireAdmin, updateSupplier);
router.delete('/delete/:id', authUser, authUser.requireAdmin, deleteSupplier);

module.exports = router;
