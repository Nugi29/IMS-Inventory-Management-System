const express = require('express');
const { getAllUserRoles, getAllUserStatuses, getAllCategories, getAllItemStatuses } = require('../controllers/LookupController');

const router = express.Router();

router.get('/get-all-user-roles', getAllUserRoles);
router.get('/get-all-user-statuses', getAllUserStatuses);
router.get('/get-all-categories', getAllCategories);
router.get('/get-all-item-statuses', getAllItemStatuses);

module.exports = router;