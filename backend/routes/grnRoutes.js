const express = require('express');
const authUser = require('../middlewares/AuthUser');
const {
	createGrn,
	getAllGrns,
	getGrnById,
	updateGrn,
	deleteGrn,
	getGrnItems,
	addGrnItem,
	createGrnFromPurchaseOrder,
	getGrnByPurchaseOrder,
	getGrnsByStatus,
	getGrnsBySupplier,
} = require('../controllers/GrnController');


const router = express.Router();

router.get('/status/:status', authUser, getGrnsByStatus);
router.get('/supplier/:supplierId', authUser, getGrnsBySupplier);
router.post('/from-po/:poId', authUser, createGrnFromPurchaseOrder);
router.get('/purchase-order/:poId', authUser, getGrnByPurchaseOrder);

router.get('/:id/items', authUser, getGrnItems);
router.post('/:id/items', authUser, addGrnItem);

router.get('/', authUser, getAllGrns);
router.get('/:id', authUser, getGrnById);
router.post('/', authUser, createGrn);
router.put('/:id', authUser, updateGrn);
router.delete('/:id', authUser, deleteGrn);



module.exports = router;