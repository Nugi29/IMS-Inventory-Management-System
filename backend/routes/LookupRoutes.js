const express = require('express');
const { getAllUserRoles, getAllUserStatuses, getAllCategories, getAllItemStatuses, getAllPoStatuses, getAllSuppliers, getAllUsers } = require('../controllers/LookupController');
const { route } = require('./PurchaseOrderRoutes');
const { getAllUserRoles, getAllUserStatuses } = require('../controllers/LookupController');

const router = express.Router();

router.get('/get-all-user-roles', getAllUserRoles);
router.get('/get-all-user-statuses', getAllUserStatuses);

router.get('/get-all-categories', getAllCategories);
router.get('/get-all-item-statuses', getAllItemStatuses);

router.get('/get-all-po-statuses', getAllPoStatuses);
router.get('/get-all-suppliers', getAllSuppliers);
router.get('/get-all-users', getAllUsers);





module.exports = router;