const { sequelize, models } = require('../config/db');

const {
    grn: Grn,
    grn_item: GrnItem,
    item: Item,
    supplier: Supplier,
    user: User,
    purchase_order: PurchaseOrder,
    purchase_order_item: PurchaseOrderItem,
} = models;

const grnInclude = [
    { model: Supplier, as: 'supplier' },
    { model: User, as: 'user' },
    { model: GrnItem, as: 'grn_items', include: [{ model: Item, as: 'item' }] },
];

const purchaseOrderInclude = [
    { model: Supplier, as: 'supplier' },
    { model: PurchaseOrderItem, as: 'purchase_order_items', include: [{ model: Item, as: 'item' }] },
];

let grnTableColumnsPromise = null;

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

const getGrnColumns = async () => {
    if (!grnTableColumnsPromise) {
        grnTableColumnsPromise = sequelize.getQueryInterface().describeTable('grn').catch((error) => {
            grnTableColumnsPromise = null;
            throw error;
        });
    }

    return grnTableColumnsPromise;
};

const hasGrnColumn = async (columnName) => {
    const columns = await getGrnColumns();
    return Object.prototype.hasOwnProperty.call(columns, columnName);
};

const normalizeItems = (body) => {
    if (Array.isArray(body.items)) {
        return body.items;
    }

    if (Array.isArray(body.grn_items)) {
        return body.grn_items;
    }

    return [];
};

const normalizeGrnStatus = (grnRecord) => {
    const plain = grnRecord && typeof grnRecord.get === 'function' ? grnRecord.get({ plain: true }) : grnRecord;
    if (plain && plain.status) {
        return String(plain.status).toLowerCase();
    }

    return Array.isArray(plain && plain.grn_items) && plain.grn_items.length > 0 ? 'received' : 'draft';
};

const attachDerivedStatus = (grnRecord) => {
    const plain = grnRecord && typeof grnRecord.get === 'function' ? grnRecord.get({ plain: true }) : { ...grnRecord };
    return {
        ...plain,
        status: plain.status ? String(plain.status).toLowerCase() : (Array.isArray(plain.grn_items) && plain.grn_items.length > 0 ? 'received' : 'draft'),
    };
};

const normalizeStatusName = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const sumItemsById = (rows) => {
    const totals = new Map();

    (rows || []).forEach((row) => {
        const itemId = Number(row?.item_id);
        const quantity = Number(row?.quantity ?? 0);

        if (!itemId || Number.isNaN(quantity)) {
            return;
        }

        totals.set(itemId, (totals.get(itemId) || 0) + quantity);
    });

    return totals;
};

const getPoStatusIdByName = async (statusNames, transaction) => {
    const statuses = await POStatus.findAll({ transaction });
    const wanted = new Set(statusNames.map(normalizeStatusName));
    const match = statuses.find((statusRow) => wanted.has(normalizeStatusName(statusRow.name)));
    return match ? match.id : null;
};

const syncPurchaseOrderReceiptStatus = async (purchaseOrderId, transaction) => {
    const parsedPurchaseOrderId = parsePositiveInt(purchaseOrderId);
    if (!parsedPurchaseOrderId) {
        return { success: false, message: 'Purchase order id is required' };
    }

    const purchaseOrder = await PurchaseOrder.findByPk(parsedPurchaseOrderId, {
        include: [{ model: PurchaseOrderItem, as: 'purchase_order_items' }],
        transaction,
    });

    if (!purchaseOrder) {
        return { success: false, message: 'Purchase order not found' };
    }

    const orderedTotals = sumItemsById(purchaseOrder.purchase_order_items || []);
    const grns = await Grn.findAll({
        where: { purchase_order_id: parsedPurchaseOrderId },
        include: [{ model: GrnItem, as: 'grn_items' }],
        transaction,
    });
    const receivedTotals = sumItemsById(grns.flatMap((grnRow) => grnRow.grn_items || []));

    let anyReceived = false;
    let allReceived = orderedTotals.size > 0;

    orderedTotals.forEach((orderedQty, itemId) => {
        const receivedQty = Number(receivedTotals.get(itemId) || 0);
        if (receivedQty > 0) {
            anyReceived = true;
        }

        if (receivedQty < orderedQty) {
            allReceived = false;
        }
    });

    const nextStatusName = allReceived && anyReceived
        ? 'fully received'
        : anyReceived
            ? 'partially received'
            : 'sent';

    const nextStatusId = await getPoStatusIdByName([nextStatusName, 'sent', 'draft'], transaction);
    if (nextStatusId) {
        purchaseOrder.po_status_id = nextStatusId;
        await purchaseOrder.save({ transaction });
    }

    return { success: true, status: nextStatusName };
};

const applyItemStockChange = async (itemId, quantityDelta, transaction) => {
    const itemData = await Item.findByPk(itemId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
    });
    if (!itemData) {
        return { success: false, status: 404, message: `Item not found: ${itemId}` };
    }

    const currentQuantity = Number(itemData.quantity) || 0;
    const nextQuantity = currentQuantity + Number(quantityDelta);
    if (nextQuantity < 0) {
        return {
            success: false,
            status: 409,
            message: `Stock cannot go below zero for item ${itemId}`,
        };
    }

    itemData.quantity = nextQuantity;
    await itemData.save({ transaction });

    return { success: true };
};

const buildGrnHeader = async (body, fallbackUserId) => {
    const supplierId = parsePositiveInt(body.supplier_id);
    const userId = parsePositiveInt(body.user_id || fallbackUserId);

    if (!supplierId) {
        return { success: false, status: 400, message: 'Valid supplier_id is required' };
    }

    if (!userId) {
        return { success: false, status: 401, message: 'Unauthorized' };
    }

    const payload = {
        supplier_id: supplierId,
        user_id: userId,
        grn_date: body.grn_date || new Date(),
        total_amount: 0,
    };

    const parsedTotalAmount = parseNonNegativeNumber(body.total_amount);
    if (body.total_amount !== undefined && parsedTotalAmount === null) {
        return { success: false, status: 400, message: 'total_amount must be a non-negative number' };
    }

    if (parsedTotalAmount !== null) {
        payload.total_amount = parsedTotalAmount;
    }

    if (body.purchase_order_id !== undefined) {
        const parsedPurchaseOrderId = parsePositiveInt(body.purchase_order_id);
        if (!parsedPurchaseOrderId) {
            return { success: false, status: 400, message: 'purchase_order_id must be a positive integer' };
        }

        if (await hasGrnColumn('purchase_order_id')) {
            payload.purchase_order_id = parsedPurchaseOrderId;
        }
    }

    if (body.status !== undefined && await hasGrnColumn('status')) {
        payload.status = String(body.status);
    }

    return { success: true, payload };
};

const loadGrnWithDetails = async (grnId) => {
    return Grn.findByPk(grnId, {
        include: grnInclude,
    });
};

const createGrn = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const headerResult = await buildGrnHeader(req.body, req.userId || req.body.userId);
        if (!headerResult.success) {
            await transaction.rollback();
            return res.status(headerResult.status).json({ success: false, message: headerResult.message });
        }

        const grnItems = normalizeItems(req.body);
        if (!Array.isArray(grnItems) || grnItems.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'At least one GRN item is required' });
        }

        const grnRecord = await Grn.create(headerResult.payload, { transaction });
        let computedTotal = 0;

        for (const row of grnItems) {
            const itemId = parsePositiveInt(row.item_id);
            const quantity = parsePositiveInt(row.quantity);
            const purchasePrice = parseNonNegativeNumber(row.purchase_price);

            if (!itemId || !quantity || purchasePrice === null) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Each GRN item needs valid item_id, quantity (> 0), and purchase_price (>= 0)',
                });
            }

            const existingItem = await Item.findByPk(itemId, { transaction });
            if (!existingItem) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: `Item not found: ${itemId}` });
            }

            await GrnItem.create({
                grn_id: grnRecord.id,
                item_id: itemId,
                quantity,
                purchase_price: purchasePrice,
            }, { transaction });

            const stockResult = await applyItemStockChange(itemId, quantity, transaction);
            if (!stockResult.success) {
                await transaction.rollback();
                return res.status(stockResult.status).json({ success: false, message: stockResult.message });
            }

            computedTotal += quantity * purchasePrice;
        }

        if (req.body.total_amount === undefined) {
            grnRecord.total_amount = computedTotal;
            await grnRecord.save({ transaction });
        }

        if (grnRecord.purchase_order_id) {
            const syncResult = await syncPurchaseOrderReceiptStatus(grnRecord.purchase_order_id, transaction);
            if (!syncResult.success) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: syncResult.message });
            }
        }

        await transaction.commit();

        const createdGrn = await loadGrnWithDetails(grnRecord.id);
        return res.status(201).json({
            success: true,
            grn: attachDerivedStatus(createdGrn),
        });
    } catch (error) {
        await transaction.rollback();
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllGrns = async (req, res) => {
    try {
        const grns = await Grn.findAll({
            include: grnInclude,
            order: [['id', 'DESC']],
        });

        return res.json({
            success: true,
            grns: grns.map((grnRecord) => attachDerivedStatus(grnRecord)),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getGrnById = async (req, res) => {
    try {
        const grnId = parsePositiveInt(req.params.id);
        if (!grnId) {
            return res.status(400).json({ success: false, message: 'GRN id is required' });
        }

        const grnRecord = await loadGrnWithDetails(grnId);
        if (!grnRecord) {
            return res.status(404).json({ success: false, message: 'GRN not found' });
        }

        return res.json({ success: true, grn: attachDerivedStatus(grnRecord) });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const updateGrn = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const grnId = parsePositiveInt(req.params.id || req.body.grn_id);
        if (!grnId) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'GRN id is required' });
        }

        const grnRecord = await Grn.findByPk(grnId, {
            include: [{ model: GrnItem, as: 'grn_items' }],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!grnRecord) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'GRN not found' });
        }

        const { supplier_id, grn_date, total_amount, purchase_order_id, status } = req.body;

        if (supplier_id !== undefined) {
            const parsedSupplierId = parsePositiveInt(supplier_id);
            if (!parsedSupplierId) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'supplier_id must be a positive integer' });
            }

            const supplierExists = await Supplier.findByPk(parsedSupplierId, { transaction });
            if (!supplierExists) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: `Supplier not found: ${parsedSupplierId}` });
            }

            grnRecord.supplier_id = parsedSupplierId;
        }

        if (grn_date !== undefined) {
            grnRecord.grn_date = grn_date;
        }

        if (total_amount !== undefined) {
            const parsedTotalAmount = parseNonNegativeNumber(total_amount);
            if (parsedTotalAmount === null) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'total_amount must be a non-negative number' });
            }

            grnRecord.total_amount = parsedTotalAmount;
        }

        if (purchase_order_id !== undefined && await hasGrnColumn('purchase_order_id')) {
            const parsedPurchaseOrderId = parsePositiveInt(purchase_order_id);
            if (!parsedPurchaseOrderId) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'purchase_order_id must be a positive integer' });
            }

            grnRecord.purchase_order_id = parsedPurchaseOrderId;
        }

        if (status !== undefined && await hasGrnColumn('status')) {
            grnRecord.status = String(status);
        }

        const hasReplacementItems = Object.prototype.hasOwnProperty.call(req.body, 'items') || Object.prototype.hasOwnProperty.call(req.body, 'grn_items');
        const replacementItems = normalizeItems(req.body);
        if (hasReplacementItems) {
            const existingItems = grnRecord.grn_items || [];

            for (const existingItem of existingItems) {
                const revertResult = await applyItemStockChange(existingItem.item_id, -Number(existingItem.quantity || 0), transaction);
                if (!revertResult.success) {
                    await transaction.rollback();
                    return res.status(revertResult.status).json({ success: false, message: revertResult.message });
                }
            }

            await GrnItem.destroy({ where: { grn_id: grnRecord.id }, transaction });

            let recomputedTotal = 0;
            for (const row of replacementItems) {
                const itemId = parsePositiveInt(row.item_id);
                const quantity = parsePositiveInt(row.quantity);
                const purchasePrice = parseNonNegativeNumber(row.purchase_price);

                if (!itemId || !quantity || purchasePrice === null) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'Each GRN item needs valid item_id, quantity (> 0), and purchase_price (>= 0)',
                    });
                }

                const itemExists = await Item.findByPk(itemId, { transaction });
                if (!itemExists) {
                    await transaction.rollback();
                    return res.status(404).json({ success: false, message: `Item not found: ${itemId}` });
                }

                await GrnItem.create({
                    grn_id: grnRecord.id,
                    item_id: itemId,
                    quantity,
                    purchase_price: purchasePrice,
                }, { transaction });

                const stockResult = await applyItemStockChange(itemId, quantity, transaction);
                if (!stockResult.success) {
                    await transaction.rollback();
                    return res.status(stockResult.status).json({ success: false, message: stockResult.message });
                }

                recomputedTotal += quantity * purchasePrice;
            }

            if (total_amount === undefined) {
                grnRecord.total_amount = recomputedTotal;
            }
        }

        if (grnRecord.purchase_order_id) {
            const syncResult = await syncPurchaseOrderReceiptStatus(grnRecord.purchase_order_id, transaction);
            if (!syncResult.success) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: syncResult.message });
            }
        }

        await grnRecord.save({ transaction });
        await transaction.commit();

        const updatedGrn = await loadGrnWithDetails(grnRecord.id);
        return res.json({
            success: true,
            message: 'GRN updated successfully',
            grn: attachDerivedStatus(updatedGrn),
        });
    } catch (error) {
        await transaction.rollback();
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deleteGrn = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const grnId = parsePositiveInt(req.params.id || req.body.grn_id);
        if (!grnId) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'GRN id is required' });
        }

        const grnRecord = await Grn.findByPk(grnId, {
            include: [{ model: GrnItem, as: 'grn_items' }],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!grnRecord) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'GRN not found' });
        }

        const purchaseOrderId = grnRecord.purchase_order_id;

        for (const grnItem of grnRecord.grn_items || []) {
            const revertResult = await applyItemStockChange(grnItem.item_id, -Number(grnItem.quantity || 0), transaction);
            if (!revertResult.success) {
                await transaction.rollback();
                return res.status(revertResult.status).json({ success: false, message: revertResult.message });
            }
        }

        await GrnItem.destroy({ where: { grn_id: grnRecord.id }, transaction });
        await grnRecord.destroy({ transaction });

        if (purchaseOrderId) {
            const syncResult = await syncPurchaseOrderReceiptStatus(purchaseOrderId, transaction);
            if (!syncResult.success) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: syncResult.message });
            }
        }

        await transaction.commit();

        return res.json({
            success: true,
            message: 'GRN deleted successfully',
            deleted_grn_id: grnId,
        });
    } catch (error) {
        await transaction.rollback();
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getGrnItems = async (req, res) => {
    try {
        const grnId = parsePositiveInt(req.params.id);
        if (!grnId) {
            return res.status(400).json({ success: false, message: 'GRN id is required' });
        }

        const grnRecord = await Grn.findByPk(grnId);
        if (!grnRecord) {
            return res.status(404).json({ success: false, message: 'GRN not found' });
        }

        const grnItems = await GrnItem.findAll({
            where: { grn_id: grnId },
            include: [{ model: Item, as: 'item' }],
            order: [['id', 'ASC']],
        });

        return res.json({ success: true, grn_items: grnItems });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const addGrnItem = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const grnId = parsePositiveInt(req.params.id);
        if (!grnId) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'GRN id is required' });
        }

        const grnRecord = await Grn.findByPk(grnId, { transaction });
        if (!grnRecord) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'GRN not found' });
        }

        const itemId = parsePositiveInt(req.body.item_id);
        const quantity = parsePositiveInt(req.body.quantity);
        const purchasePrice = parseNonNegativeNumber(req.body.purchase_price);

        if (!itemId || !quantity || purchasePrice === null) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Valid item_id, quantity (> 0), and purchase_price (>= 0) are required',
            });
        }

        const itemExists = await Item.findByPk(itemId, { transaction });
        if (!itemExists) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: `Item not found: ${itemId}` });
        }

        const grnItem = await GrnItem.create({
            grn_id: grnId,
            item_id: itemId,
            quantity,
            purchase_price: purchasePrice,
        }, { transaction });

        const stockResult = await applyItemStockChange(itemId, quantity, transaction);
        if (!stockResult.success) {
            await transaction.rollback();
            return res.status(stockResult.status).json({ success: false, message: stockResult.message });
        }

        grnRecord.total_amount = (Number(grnRecord.total_amount) || 0) + (quantity * purchasePrice);
        await grnRecord.save({ transaction });

        if (grnRecord.purchase_order_id) {
            const syncResult = await syncPurchaseOrderReceiptStatus(grnRecord.purchase_order_id, transaction);
            if (!syncResult.success) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: syncResult.message });
            }
        }

        await transaction.commit();

        return res.status(201).json({ success: true, grn_item: grnItem });
    } catch (error) {
        await transaction.rollback();
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getGrnsBySupplier = async (req, res) => {
    try {
        const supplierId = parsePositiveInt(req.params.supplierId);
        if (!supplierId) {
            return res.status(400).json({ success: false, message: 'Supplier id is required' });
        }

        const grns = await Grn.findAll({
            where: { supplier_id: supplierId },
            include: grnInclude,
            order: [['id', 'DESC']],
        });

        return res.json({
            success: true,
            grns: grns.map((grnRecord) => attachDerivedStatus(grnRecord)),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getGrnsByStatus = async (req, res) => {
    try {
        const requestedStatus = String(req.params.status || '').trim().toLowerCase();
        if (!requestedStatus) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        const grns = await Grn.findAll({
            include: grnInclude,
            order: [['id', 'DESC']],
        });

        const filtered = grns.filter((grnRecord) => {
            const actualStatus = normalizeGrnStatus(grnRecord);

            if (requestedStatus === 'all') {
                return true;
            }

            if (requestedStatus === actualStatus) {
                return true;
            }

            if (requestedStatus === 'received' || requestedStatus === 'complete' || requestedStatus === 'with-items') {
                return actualStatus === 'received';
            }

            if (requestedStatus === 'draft' || requestedStatus === 'empty' || requestedStatus === 'without-items') {
                return actualStatus === 'draft';
            }

            return actualStatus === requestedStatus;
        }).map((grnRecord) => attachDerivedStatus(grnRecord));

        return res.json({ success: true, grns: filtered });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getGrnByPurchaseOrder = async (req, res) => {
    try {
        const poId = parsePositiveInt(req.params.poId);
        if (!poId) {
            return res.status(400).json({ success: false, message: 'Purchase order id is required' });
        }

        const purchaseOrder = await PurchaseOrder.findByPk(poId, {
            include: purchaseOrderInclude,
        });

        if (!purchaseOrder) {
            return res.status(404).json({ success: false, message: 'Purchase order not found' });
        }

        if (await hasGrnColumn('purchase_order_id')) {
            const grns = await Grn.findAll({
                where: { purchase_order_id: poId },
                include: grnInclude,
                order: [['id', 'DESC']],
            });

            return res.json({
                success: true,
                grns: grns.map((grnRecord) => attachDerivedStatus(grnRecord)),
            });
        }

        const grns = await Grn.findAll({
            where: { supplier_id: purchaseOrder.supplier_id },
            include: grnInclude,
            order: [['id', 'DESC']],
        });

        const poItems = (purchaseOrder.purchase_order_items || []).map((row) => ({
            item_id: Number(row.item_id),
            quantity: Number(row.quantity) || 0,
            purchase_price: Number(row.expected_price) || 0,
        })).sort((left, right) => left.item_id - right.item_id);

        const match = grns.find((grnRecord) => {
            const grnItems = (grnRecord.grn_items || []).map((row) => ({
                item_id: Number(row.item_id),
                quantity: Number(row.quantity) || 0,
                purchase_price: Number(row.purchase_price) || 0,
            })).sort((left, right) => left.item_id - right.item_id);

            if (grnItems.length !== poItems.length) {
                return false;
            }

            return grnItems.every((row, index) => {
                const expected = poItems[index];
                return row.item_id === expected.item_id && row.quantity === expected.quantity && row.purchase_price === expected.purchase_price;
            });
        });

        if (!match) {
            return res.status(404).json({ success: false, message: 'GRN not found for this purchase order' });
        }

        return res.json({ success: true, grns: [attachDerivedStatus(match)] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const createGrnFromPurchaseOrder = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const poId = parsePositiveInt(req.params.poId);
        if (!poId) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Purchase order id is required' });
        }

        const purchaseOrder = await PurchaseOrder.findByPk(poId, {
            include: purchaseOrderInclude,
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!purchaseOrder) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Purchase order not found' });
        }

        const poItems = purchaseOrder.purchase_order_items || [];
        if (poItems.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Purchase order has no items' });
        }

        const headerResult = await buildGrnHeader({
            supplier_id: purchaseOrder.supplier_id,
            user_id: req.userId || req.body.userId,
            grn_date: req.body.grn_date || new Date(),
            total_amount: req.body.total_amount,
            purchase_order_id: poId,
            status: req.body.status || 'received',
        }, req.userId || req.body.userId);

        if (!headerResult.success) {
            await transaction.rollback();
            return res.status(headerResult.status).json({ success: false, message: headerResult.message });
        }

        const grnRecord = await Grn.create(headerResult.payload, { transaction });
        let computedTotal = 0;

        for (const row of poItems) {
            const quantity = parsePositiveInt(row.quantity);
            const purchasePrice = parseNonNegativeNumber(row.expected_price);

            if (!quantity || purchasePrice === null) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Purchase order items need valid quantity (> 0) and expected_price (>= 0)',
                });
            }

            const itemId = parsePositiveInt(row.item_id);
            const itemExists = await Item.findByPk(itemId, { transaction });
            if (!itemExists) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: `Item not found: ${itemId}` });
            }

            await GrnItem.create({
                grn_id: grnRecord.id,
                item_id: itemId,
                quantity,
                purchase_price: purchasePrice,
            }, { transaction });

            const stockResult = await applyItemStockChange(itemId, quantity, transaction);
            if (!stockResult.success) {
                await transaction.rollback();
                return res.status(stockResult.status).json({ success: false, message: stockResult.message });
            }

            computedTotal += quantity * purchasePrice;
        }

        if (req.body.total_amount === undefined) {
            grnRecord.total_amount = computedTotal || Number(purchaseOrder.total_amount) || 0;
            await grnRecord.save({ transaction });
        }

        const syncResult = await syncPurchaseOrderReceiptStatus(poId, transaction);
        if (!syncResult.success) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: syncResult.message });
        }

        await transaction.commit();

        const createdGrn = await loadGrnWithDetails(grnRecord.id);
        return res.status(201).json({ success: true, grn: attachDerivedStatus(createdGrn) });
    } catch (error) {
        await transaction.rollback();
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
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
};