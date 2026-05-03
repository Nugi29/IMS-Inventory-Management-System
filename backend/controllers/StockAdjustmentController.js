const { Op } = require('sequelize');
const { sequelize, models } = require('../config/db');
const { syncItemStatusByQuantity } = require('../utils/itemStatusSync');

const {
    stock_adjustment: StockAdjustment,
    stock_movement: StockMovement,
    movement_type: MovementType,
    item: Item,
    user: User,
} = models;

const toInt = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
};

const toPositiveInt = (value) => {
    const parsed = toInt(value);
    return parsed && parsed > 0 ? parsed : null;
};

const getOrCreateAdjustmentMovementTypeId = async (transaction) => {
    const movementType = await MovementType.findOne({
        where: {
            [Op.or]: [
                { id: 3 },
                sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), 'adjustment'),
            ],
        },
        transaction,
    });

    if (movementType) {
        return movementType.id;
    }

    const created = await MovementType.create({ name: 'Adjustment' }, { transaction });
    return created.id;
};

const createStockAdjustment = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { item_id, quantity, reason, user_id } = req.body;

        const parsedItemId = toPositiveInt(item_id);
        const parsedQuantity = toInt(quantity);
        const parsedUserId = toPositiveInt(user_id) || toPositiveInt(req.userId);

        if (!parsedItemId || parsedQuantity === null || parsedQuantity === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'item_id and quantity are required. quantity must be a non-zero integer',
            });
        }

        const itemData = await Item.findByPk(parsedItemId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!itemData) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const currentQty = Number(itemData.quantity) || 0;
        const nextQty = currentQty + parsedQuantity;
        if (nextQty < 0) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: `Insufficient stock. Current quantity is ${currentQty}`,
            });
        }

        const adjustment = await StockAdjustment.create({
            item_id: parsedItemId,
            quantity: parsedQuantity,
            reason: reason ? String(reason).trim() : null,
            user_id: parsedUserId,
        }, { transaction });

        itemData.quantity = nextQty;
        await itemData.save({ transaction });

        // Auto-sync item status based on new quantity
        await syncItemStatusByQuantity(itemData, { transaction });

        const adjustmentMovementTypeId = await getOrCreateAdjustmentMovementTypeId(transaction);
        await StockMovement.create({
            item_id: parsedItemId,
            quantity: parsedQuantity,
            stock_adjustment_id: adjustment.id,
            grn_id: null,
            sale_id: null,
            user_id: parsedUserId,
            movement_type_id: adjustmentMovementTypeId,
            createdAt: new Date(),
        }, { transaction });

        await transaction.commit();

        return res.status(201).json({
            success: true,
            message: 'Stock adjustment recorded',
            adjustment,
            item_stock: {
                item_id: parsedItemId,
                previous_quantity: currentQty,
                new_quantity: nextQty,
            },
        });
    } catch (error) {
        await transaction.rollback();
        console.error('createStockAdjustment error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getStockAdjustments = async (req, res) => {
    try {
        const { item_id, user_id, limit } = req.query;

        const where = {};
        const parsedItemId = toPositiveInt(item_id);
        const parsedUserId = toPositiveInt(user_id);

        if (item_id !== undefined && !parsedItemId) {
            return res.status(400).json({ success: false, message: 'item_id must be a positive integer' });
        }

        if (user_id !== undefined && !parsedUserId) {
            return res.status(400).json({ success: false, message: 'user_id must be a positive integer' });
        }

        if (parsedItemId) {
            where.item_id = parsedItemId;
        }

        if (parsedUserId) {
            where.user_id = parsedUserId;
        }

        const parsedLimit = toPositiveInt(limit);

        const queryOptions = {
            where,
            include: [
                { model: Item, as: 'item', attributes: ['id', 'name', 'code'] },
                { model: User, as: 'user', attributes: ['id', 'name', 'username'] },
            ],
            order: [['id', 'DESC']],
        };

        if (parsedLimit) {
            queryOptions.limit = parsedLimit;
        }

        const adjustments = await StockAdjustment.findAll(queryOptions);

        return res.json({ success: true, adjustments });
    } catch (error) {
        console.error('getStockAdjustments error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createStockAdjustment,
    getStockAdjustments,
};
