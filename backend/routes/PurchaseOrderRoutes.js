const express = require('express');
const {
	createPurchaseOrder,
	getAllPurchaseOrders,
	updatePurchaseOrder,
	deletePurchaseOrder,
} = require('../controllers/PurchaseOrderController');
const authUser = require('../middlewares/AuthUser');

const router = express.Router();

router.post('/create', authUser, createPurchaseOrder);
router.get('/all-po', authUser, getAllPurchaseOrders);
router.put('/update/:id', authUser, updatePurchaseOrder);
router.delete('/delete/:id', authUser, deletePurchaseOrder);

module.exports = router;
