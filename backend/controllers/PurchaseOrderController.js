const { sequelize, models } = require('../config/db');

const {
    purchase_order: PurchaseOrder,
    purchase_order_item: PurchaseOrderItem,
    po_status: POStatus,
    supplier: Supplier,
    user: User,
    item: Item,
} = models;
const { sendPurchaseOrderEmail } = require('../utils/emailService');


const purchaseOrderInclude = [
    { model: User, as: 'created_by_user' },
    { model: Supplier, as: 'supplier' },
    { model: POStatus, as: 'po_status' },
    { model: PurchaseOrderItem, as: 'purchase_order_items', include: [{ model: Item, as: 'item' }] },
];

const parsePositiveNumber = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
};

const parsePositiveInt = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
};

const parseNonNegativeNumber = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) {
        return null;
    }

    return parsed;
};

const createPurchaseOrder = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { supplier_id, po_status_id, order_date, total_amount, items } = req.body;
        const createdBy = req.userId || req.body.userId;

        const parsedSupplierId = parsePositiveInt(supplier_id);
        if (!parsedSupplierId) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Valid supplier_id is required' });
        }

        const supplierRecord = await Supplier.findByPk(parsedSupplierId, { transaction });
        if (!supplierRecord) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }

        if (Number(supplierRecord.supplier_status_id) !== 1) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot create purchase order — Supplier "${supplierRecord.name}" is inactive.`,
            });
        }

        if (!createdBy) {
            await transaction.rollback();
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const parsedStatusId = po_status_id !== undefined ? parsePositiveInt(po_status_id) : 1;
        if (!parsedStatusId) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'po_status_id must be a positive integer' });
        }

        const parsedTotalAmount = parseNonNegativeNumber(total_amount);
        if (total_amount !== undefined && parsedTotalAmount === null) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'total_amount must be a non-negative number' });
        }

        const purchaseOrder = await PurchaseOrder.create({
            supplier_id: parsedSupplierId,
            created_by: Number(createdBy),
            po_status_id: parsedStatusId,
            order_date: order_date || new Date(),
            total_amount: parsedTotalAmount !== null ? parsedTotalAmount : 0,
        }, { transaction });

        let computedTotal = 0;

        if (Array.isArray(items) && items.length > 0) {
            for (const row of items) {
                const itemId = Number(row.item_id);
                const quantity = Number(row.quantity);
                const expectedPrice = parsePositiveNumber(row.expected_price);

                if (!itemId || Number.isNaN(quantity) || quantity <= 0 || expectedPrice === null) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'Each item needs valid item_id, quantity (> 0), and expected_price (> 0)',
                    });
                }

                const existingItem = await Item.findByPk(itemId, { transaction });
                if (!existingItem) {
                    await transaction.rollback();
                    return res.status(404).json({ success: false, message: `Item not found: ${itemId}` });
                }

                await PurchaseOrderItem.create({
                    purchase_order_id: purchaseOrder.id,
                    item_id: itemId,
                    quantity,
                    expected_price: expectedPrice,
                }, { transaction });

                computedTotal += quantity * expectedPrice;
            }

            if (parsedTotalAmount === null) {
                purchaseOrder.total_amount = computedTotal;
                await purchaseOrder.save({ transaction });
            }
        }


        await transaction.commit();

        const created = await PurchaseOrder.findByPk(purchaseOrder.id, {
            include: purchaseOrderInclude,
        });

        // Send email if requested
        if (req.body.send_to_supplier && created) {
            // We don't await this to avoid delaying the response, 
            // or we can await it if we want to ensure it's sent.
            // The user said "after i create", so let's do it after commit.
            sendPurchaseOrderEmail(created.supplier, created).catch(err => {
                console.error('Background email sending failed:', err);
            });
        }

        return res.status(201).json({ success: true, purchaseOrder: created });
    } catch (error) {

        await transaction.rollback();
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllPurchaseOrders = async (req, res) => {
    try {
        const purchaseOrders = await PurchaseOrder.findAll({
            include: purchaseOrderInclude,
            order: [['id', 'DESC']],
        });

        return res.json({ success: true, purchaseOrders });
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const updatePurchaseOrder = async (req, res) => {
    try {
        const purchaseOrderId = parsePositiveInt(req.params.id || req.body.purchase_order_id);
        if (!purchaseOrderId) {
            return res.status(400).json({ success: false, message: 'Purchase order id is required' });
        }

        const purchaseOrder = await PurchaseOrder.findByPk(purchaseOrderId);
        if (!purchaseOrder) {
            return res.status(404).json({ success: false, message: 'Purchase order not found' });
        }

        const { supplier_id, po_status_id, order_date, total_amount } = req.body;

        if (supplier_id !== undefined) {
            const parsedSupplierId = parsePositiveInt(supplier_id);
            if (!parsedSupplierId) {
                return res.status(400).json({ success: false, message: 'supplier_id must be a positive integer' });
            }

            const supplierRecord = await Supplier.findByPk(parsedSupplierId);
            if (!supplierRecord) {
                return res.status(404).json({ success: false, message: 'Supplier not found' });
            }

            if (Number(supplierRecord.supplier_status_id) !== 1) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot update purchase order — Supplier "${supplierRecord.name}" is inactive.`,
                });
            }

            purchaseOrder.supplier_id = parsedSupplierId;
        }

        if (po_status_id !== undefined) {
            const parsedStatusId = parsePositiveInt(po_status_id);
            if (!parsedStatusId) {
                return res.status(400).json({ success: false, message: 'po_status_id must be a positive integer' });
            }
            purchaseOrder.po_status_id = parsedStatusId;
        }

        if (order_date !== undefined) {
            purchaseOrder.order_date = order_date;
        }

        if (total_amount !== undefined) {
            const parsedAmount = parseNonNegativeNumber(total_amount);
            if (parsedAmount === null) {
                return res.status(400).json({ success: false, message: 'total_amount must be a non-negative number' });
            }
            purchaseOrder.total_amount = parsedAmount;
        }

        await purchaseOrder.save();

        const updated = await PurchaseOrder.findByPk(purchaseOrderId, {
            include: purchaseOrderInclude,
        });

        return res.json({
            success: true,
            message: 'Purchase order updated successfully',
            purchaseOrder: updated,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deletePurchaseOrder = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const purchaseOrderId = parsePositiveInt(req.params.id || req.body.purchase_order_id);
        if (!purchaseOrderId) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Purchase order id is required' });
        }

        const purchaseOrder = await PurchaseOrder.findByPk(purchaseOrderId, { transaction });
        if (!purchaseOrder) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Purchase order not found' });
        }

        await PurchaseOrderItem.destroy({
            where: { purchase_order_id: purchaseOrderId },
            transaction,
        });

        await purchaseOrder.destroy({ transaction });
        await transaction.commit();

        return res.json({
            success: true,
            message: 'Purchase order deleted successfully',
            deleted_purchase_order_id: purchaseOrderId,
        });
    } catch (error) {
        await transaction.rollback();
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createPurchaseOrder,
    getAllPurchaseOrders,
    updatePurchaseOrder,
    deletePurchaseOrder,
};
