const { sequelize, models } = require('../config/db');

const {
    stock_movement: StockMovement,
    stock_adjustment: StockAdjustment,
    item: Item,
    movement_type: MovementType,
    user: User,
    grn: Grn,
    sale: Sale,
} = models;

const toPositiveInt = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
};

const resolveDirection = (directionFromBody, movementTypeName) => {
    const bodyDirection = String(directionFromBody || '').trim().toLowerCase();
    if (bodyDirection === 'in' || bodyDirection === 'out') {
        return bodyDirection;
    }

    const name = String(movementTypeName || '').trim().toLowerCase();
    if (!name) {
        return null;
    }

    if (/(out|sale|issue|remove|deduct|decrease)/.test(name)) {
        return 'out';
    }

    return 'in';
};

const createStockMovement = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            item_id,
            movement_type_id,
            quantity,
            direction,
            grn_id,
            sale_id,
            stock_adjustment_id,
            user_id,
        } = req.body;

        const parsedItemId = toPositiveInt(item_id);
        const parsedMovementTypeId = toPositiveInt(movement_type_id);
        const parsedQuantity = toPositiveInt(quantity);

        if (!parsedItemId || !parsedMovementTypeId || !parsedQuantity) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'item_id, movement_type_id and quantity (positive integers) are required',
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

        const movementType = await MovementType.findByPk(parsedMovementTypeId, { transaction });
        if (!movementType) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Movement type not found' });
        }

        const movementDirection = resolveDirection(direction, movementType.name);
        if (!movementDirection) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'direction is required when movement type name cannot infer in/out',
            });
        }

        const currentQty = Number(itemData.quantity) || 0;
        const nextQty = movementDirection === 'out'
            ? currentQty - parsedQuantity
            : currentQty + parsedQuantity;

        if (nextQty < 0) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: `Insufficient stock. Current quantity is ${currentQty}`,
            });
        }

        itemData.quantity = nextQty;
        await itemData.save({ transaction });

        const movement = await StockMovement.create({
            item_id: parsedItemId,
            movement_type_id: parsedMovementTypeId,
            quantity: parsedQuantity,
            grn_id: toPositiveInt(grn_id),
            sale_id: toPositiveInt(sale_id),
            stock_adjustment_id: toPositiveInt(stock_adjustment_id),
            user_id: toPositiveInt(user_id) || toPositiveInt(req.userId),
            created_at: new Date(),
        }, { transaction });

        await transaction.commit();

        return res.status(201).json({
            success: true,
            message: 'Stock movement recorded',
            movement,
            item_stock: {
                item_id: parsedItemId,
                previous_quantity: currentQty,
                new_quantity: nextQty,
            },
        });
    } catch (error) {
        await transaction.rollback();
        console.error('createStockMovement error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getStockMovements = async (req, res) => {
    try {
        const { item_id, movement_type_id, limit } = req.query;

        const where = {};
        const parsedItemId = toPositiveInt(item_id);
        const parsedMovementTypeId = toPositiveInt(movement_type_id);

        if (item_id !== undefined && !parsedItemId) {
            return res.status(400).json({ success: false, message: 'item_id must be a positive integer' });
        }

        if (movement_type_id !== undefined && !parsedMovementTypeId) {
            return res.status(400).json({ success: false, message: 'movement_type_id must be a positive integer' });
        }

        if (parsedItemId) {
            where.item_id = parsedItemId;
        }

        if (parsedMovementTypeId) {
            where.movement_type_id = parsedMovementTypeId;
        }

        const parsedLimit = toPositiveInt(limit);

        const queryOptions = {
            where,
            include: [
                { 
                    model: Item, 
                    as: 'item', 
                    attributes: [
                        'id', 
                        'name',
                        'code',
                        'quantity',
                        'category_id',
                    ]
                },
                { model: MovementType, as: 'movement_type', attributes: ['id', 'name'] },
                { model: User, as: 'user', attributes: ['id', 'name', 'username'] },
                { model: Grn, as: 'grn', attributes: ['id'], required: false },
                { model: Sale, as: 'sale', attributes: ['id'], required: false },
                { model: StockAdjustment, as: 'stock_adjustment', attributes: ['id', 'reason', 'quantity'], required: false },
            ],
            order: [['id', 'DESC']],
            distinct: true,
            subQuery: false,
        };

        if (parsedLimit) {
            queryOptions.limit = parsedLimit;
        }

        const movements = await StockMovement.findAll(queryOptions);

        const movementsWithAliases = movements.map((movement) => {
            const data = movement.get({ plain: true });
            if (data.item) {
                data.item.item_name = data.item.name;
                data.item.sku = data.item.code;
            }

            const adjustmentReason = data.stock_adjustment?.reason || null;
            return {
                ...data,
                item_name: data.item?.item_name || data.item?.name || 'Unknown',
                sku: data.item?.sku || data.item?.code || '-',
                reason: adjustmentReason,
                remarks: adjustmentReason,
                created_at: data.created_at || new Date().toISOString(),
            };
        });

        return res.json({ success: true, movements: movementsWithAliases });
    } catch (error) {
        console.error('getStockMovements error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createStockMovement,
    getStockMovements,
};
