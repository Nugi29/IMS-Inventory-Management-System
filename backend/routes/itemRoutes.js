const express = require('express');
const { createItem, getItem, getAllItems, updateItem, deleteItem, getNextSku } = require('../controllers/ItemController');
const authUser = require('../middlewares/AuthUser');
const { requireAdmin } = require('../middlewares/AuthUser');

const router = express.Router();

router.post('/create-item', authUser, createItem);
router.get('/all-items', authUser, getAllItems);
router.get('/get/:id', authUser, getItem);
router.get('/next-sku', authUser, getNextSku);
router.put('/update-item/:id', authUser, updateItem);
router.delete('/delete-item/:id', authUser, requireAdmin, deleteItem);

module.exports = router;
