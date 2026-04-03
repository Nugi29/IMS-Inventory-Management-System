const express = require('express');
const { getAllUserRoles, getAllUserStatuses } = require('../controllers/LookupController');

const router = express.Router();

router.get('/get-all-user-roles', getAllUserRoles);
router.get('/get-all-user-statuses', getAllUserStatuses);

module.exports = router;