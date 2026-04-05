const express = require('express');
const { createSupplier, getAllSuppliers, getSupplierById, getSupplierByName, updateSupplier, deleteSupplier } = require('../controllers/SupplierController');
const authUser = require('../middlewares/AuthUser');

const router = express.Router();

router.post('/', authUser, authUser.requireAdmin, createSupplier);
router.get('/', authUser, getAllSuppliers);
router.get('/search/:name', authUser, getSupplierByName);
router.get('/:id', authUser, getSupplierById);
router.put('/:id', authUser, authUser.requireAdmin, updateSupplier);
router.delete('/:id', authUser, authUser.requireAdmin, deleteSupplier);

module.exports = router;
