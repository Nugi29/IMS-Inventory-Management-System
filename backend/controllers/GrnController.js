const { sequelize, models } = require('../config/db');
const { syncItemStatusByQuantity } = require('../utils/itemStatusSync');

const {
    grn: Grn,
    grn_item: GrnItem,
    item: Item,
    stock_movement: StockMovement,
    supplier: Supplier,
    user: User,
    grn_status: GrnStatus,
    po_status: POStatus,
    purchase_order: PurchaseOrder,
    purchase_order_item: PurchaseOrderItem,
} = models;

const grnInclude = [
    { model: Supplier, as: 'supplier' },
    { model: User, as: 'user' },
    { model: PurchaseOrder, as: 'purchase_order' },
    { model: GrnStatus, as: 'grn_status' },
    { model: GrnItem, as: 'grn_items', include: [{ model: Item, as: 'item' }] },
];

const purchaseOrderInclude = [
    { model: Supplier, as: 'supplier' },
    { model: PurchaseOrderItem, as: 'purchase_order_items', include: [{ model: Item, as: 'item' }] },
];

let grnTableColumnsPromise = null;
let grnItemTableColumnsPromise = null;

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

const getGrnItemColumns = async () => {
    if (!grnItemTableColumnsPromise) {
        grnItemTableColumnsPromise = sequelize.getQueryInterface().describeTable('grn_item').catch((error) => {
            grnItemTableColumnsPromise = null;
            throw error;
        });
    }

    return grnItemTableColumnsPromise;
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
    const statusRelation = (plain && (plain.grn_status || plain.po_status)) || null;
    const relationStatusName = statusRelation && statusRelation.name ? String(statusRelation.name).toLowerCase() : null;
    if (relationStatusName) {
        return relationStatusName;
    }

    if (plain && plain.status) {
        return String(plain.status).toLowerCase();
    }

    return Array.isArray(plain && plain.grn_items) && plain.grn_items.length > 0 ? 'received' : 'draft';
};

const attachDerivedStatus = (grnRecord) => {
    const plain = grnRecord && typeof grnRecord.get === 'function' ? grnRecord.get({ plain: true }) : { ...grnRecord };
    const statusRelation = (plain && (plain.grn_status || plain.po_status)) || null;
    const relationStatusName = statusRelation && statusRelation.name ? String(statusRelation.name).toLowerCase() : null;
    return {
        ...plain,
        status: relationStatusName || (plain.status ? String(plain.status).toLowerCase() : (Array.isArray(plain.grn_items) && plain.grn_items.length > 0 ? 'received' : 'draft')),
    };
};

const normalizeStatusName = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
const cancelledGrnStatusNames = ['cancelled', 'canceled', 'cancel'];
const isCancelledStatus = (statusName) => cancelledGrnStatusNames.includes(normalizeStatusName(statusName));

const getRowQuantityValue = (row) => {
    if (!row) {
        return 0;
    }

    const value = row.recieved_quantity ?? row.received_quantity ?? row.total_quantity ?? row.quantity ?? 0;
    return Number(value) || 0;
};

const parseGrnItemQuantities = (row) => {
    const totalQuantity = parsePositiveInt(row.total_quantity ?? row.quantity ?? row.recieved_quantity ?? row.received_quantity);
    const receivedQuantity = parsePositiveInt(row.recieved_quantity ?? row.received_quantity ?? row.quantity ?? row.total_quantity);

    if (!totalQuantity || !receivedQuantity || receivedQuantity > totalQuantity) {
        return null;
    }

    return { totalQuantity, receivedQuantity };
};

const buildGrnItemPayload = (columns, { grnId, itemId, totalQuantity, receivedQuantity, purchasePrice }) => {
    const payload = {
        grn_id: grnId,
        item_id: itemId,
        purchase_price: purchasePrice,
    };

    if (Object.prototype.hasOwnProperty.call(columns, 'total_quantity')) {
        payload.total_quantity = totalQuantity;
    }

    if (Object.prototype.hasOwnProperty.call(columns, 'recieved_quantity')) {
        payload.recieved_quantity = receivedQuantity;
    }

    if (Object.prototype.hasOwnProperty.call(columns, 'received_quantity')) {
        payload.received_quantity = receivedQuantity;
    }

    if (Object.prototype.hasOwnProperty.call(columns, 'quantity')) {
        payload.quantity = receivedQuantity;
    }

    return payload;
};

const sumItemsById = (rows) => {
    const totals = new Map();

    (rows || []).forEach((row) => {
        const itemId = Number(row?.item_id);
        const quantity = getRowQuantityValue(row);

        if (!itemId || Number.isNaN(quantity)) {
            return;
        }

        totals.set(itemId, (totals.get(itemId) || 0) + quantity);
    });

    return totals;
};

const getPoStatusIdByName = async (statusNames, transaction) => {
    const statuses = await POStatus.findAll({ transaction });
    const wanted = (statusNames || []).map(normalizeStatusName).filter(Boolean);
    if (!wanted.length) {
        return null;
    }

    for (const wantedName of wanted) {
        const match = statuses.find((statusRow) => normalizeStatusName(statusRow.name) === wantedName);
        if (match) {
            return match.id;
        }
    }

    return null;
};

const getGrnStatusIdByName = async (statusNames, transaction) => {
    const statuses = await GrnStatus.findAll({ transaction });
    if (!statuses || statuses.length === 0) {
        return null;
    }

    const wanted = (statusNames || []).map(normalizeStatusName).filter(Boolean);
    for (const wantedName of wanted) {
        const namedMatch = statuses.find((statusRow) => normalizeStatusName(statusRow.name) === wantedName);
        if (namedMatch) {
            return namedMatch.id;
        }
    }

    return statuses[0].id;
};

const getGrnStatusNameById = async (statusId, transaction) => {
    const parsedStatusId = parsePositiveInt(statusId);
    if (!parsedStatusId) {
        return null;
    }

    const statusRow = await GrnStatus.findByPk(parsedStatusId, { transaction });
    if (!statusRow || !statusRow.name) {
        return null;
    }

    return normalizeStatusName(statusRow.name);
};

const mapPoStatusIdToGrnStatusId = async (poStatusId, transaction) => {
    const parsedPoStatusId = parsePositiveInt(poStatusId);
    if (!parsedPoStatusId) {
        return null;
    }

    const poStatus = await POStatus.findByPk(parsedPoStatusId, { transaction });
    if (!poStatus || !poStatus.name) {
        return null;
    }

    return getGrnStatusIdByName([poStatus.name], transaction);
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
    const activeGrns = grns.filter((grnRow) => !isCancelledStatus(normalizeGrnStatus(grnRow)));
    const receivedTotals = sumItemsById(activeGrns.flatMap((grnRow) => grnRow.grn_items || []));

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

    // Auto-sync item status (Active <-> Out of Stock) based on new quantity
    await syncItemStatusByQuantity(itemData, { transaction });

    return { success: true };
};

const createGrnStockMovement = async ({ itemId, grnId, userId, quantity, transaction }) => {
    await StockMovement.create({
        item_id: itemId,
        quantity,
        grn_id: grnId,
        sale_id: null,
        user_id: userId || null,
        movement_type_id: 1,
        createdAt: new Date(),
    }, { transaction });
};

const buildGrnHeader = async (body, fallbackUserId) => {
    const supplierId = parsePositiveInt(body.supplier_id);
    const userId = parsePositiveInt(body.user_id || fallbackUserId);

    if (!supplierId) {
        return { success: false, status: 400, message: 'Valid supplier_id is required' };
    }

    const supplierRecord = await Supplier.findByPk(supplierId);
    if (!supplierRecord) {
        return { success: false, status: 404, message: 'Supplier not found' };
    }

    if (Number(supplierRecord.supplier_status_id) !== 1) {
        return {
            success: false,
            status: 400,
            message: `Cannot process GRN — Supplier "${supplierRecord.name}" is inactive.`,
        };
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

    if (await hasGrnColumn('purchase_order_id')) {
        const parsedPurchaseOrderId = parsePositiveInt(body.purchase_order_id);
        if (!parsedPurchaseOrderId) {
            return { success: false, status: 400, message: 'purchase_order_id is required and must be a positive integer' };
        }

        payload.purchase_order_id = parsedPurchaseOrderId;
    }

    if (body.status !== undefined && await hasGrnColumn('status')) {
        payload.status = String(body.status);
    }

    const grnStatusColumn = await hasGrnColumn('grn_status_id')
        ? 'grn_status_id'
        : (await hasGrnColumn('po_status_id') ? 'po_status_id' : null);

    if (grnStatusColumn) {
        const requestedGrnStatusId = parsePositiveInt(body.grn_status_id);
        if (requestedGrnStatusId) {
            payload[grnStatusColumn] = requestedGrnStatusId;
        } else {
            const mappedFromPoStatus = await mapPoStatusIdToGrnStatusId(body.po_status_id, null);
            if (mappedFromPoStatus) {
                payload[grnStatusColumn] = mappedFromPoStatus;
            } else {
                const statusFromBody = String(body.status || '').trim();
                const suggestedStatuses = [];

                if (statusFromBody) {
                    suggestedStatuses.push(statusFromBody);
                }

                const hasItems = Array.isArray(body.items) ? body.items.length > 0 : Array.isArray(body.grn_items) ? body.grn_items.length > 0 : false;
                suggestedStatuses.push(hasItems ? 'received' : 'draft', 'pending', 'created');

                const grnStatusId = await getGrnStatusIdByName(suggestedStatuses, null);
                if (grnStatusId) {
                    payload[grnStatusColumn] = grnStatusId;
                }
            }
        }
    }

    if (grnStatusColumn && !payload[grnStatusColumn]) {
        return { success: false, status: 400, message: 'A valid grn_status_id (or status name) is required' };
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
        const grnItemColumns = await getGrnItemColumns();
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
            const quantities = parseGrnItemQuantities(row);
            const purchasePrice = parseNonNegativeNumber(row.purchase_price);

            if (!itemId || !quantities || purchasePrice === null) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Each GRN item needs valid item_id, quantities (use quantity or total_quantity/recieved_quantity), and purchase_price (>= 0)',
                });
            }

            const existingItem = await Item.findByPk(itemId, { transaction });
            if (!existingItem) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: `Item not found: ${itemId}` });
            }

            await GrnItem.create(buildGrnItemPayload(grnItemColumns, {
                grnId: grnRecord.id,
                itemId,
                totalQuantity: quantities.totalQuantity,
                receivedQuantity: quantities.receivedQuantity,
                purchasePrice,
            }), { transaction });

            const stockResult = await applyItemStockChange(itemId, quantities.receivedQuantity, transaction);
            if (!stockResult.success) {
                await transaction.rollback();
                return res.status(stockResult.status).json({ success: false, message: stockResult.message });
            }

            await createGrnStockMovement({
                itemId,
                grnId: grnRecord.id,
                userId: grnRecord.user_id,
                quantity: quantities.receivedQuantity,
                transaction,
            });

            computedTotal += quantities.receivedQuantity * purchasePrice;
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
        const grnItemColumns = await getGrnItemColumns();
        const grnId = parsePositiveInt(req.params.id || req.body.grn_id);
        if (!grnId) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'GRN id is required' });
        }

        const grnRecord = await Grn.findByPk(grnId, {
            include: [
                { model: GrnItem, as: 'grn_items' },
                { model: GrnStatus, as: 'grn_status' },
            ],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!grnRecord) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'GRN not found' });
        }

        const currentStatusName = normalizeGrnStatus(grnRecord);
        if (isCancelledStatus(currentStatusName)) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: 'Cancelled GRN cannot be updated. Create a new GRN for new stock.',
            });
        }

        const { supplier_id, grn_date, total_amount, purchase_order_id, status, grn_status_id, po_status_id } = req.body;
        const hasReplacementItems = Object.prototype.hasOwnProperty.call(req.body, 'items') || Object.prototype.hasOwnProperty.call(req.body, 'grn_items');
        const replacementItems = normalizeItems(req.body);
        let nextStatusName = currentStatusName;

        if (supplier_id !== undefined) {
            const parsedSupplierId = parsePositiveInt(supplier_id);
            if (!parsedSupplierId) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'supplier_id must be a positive integer' });
            }

            const supplierRecord = await Supplier.findByPk(parsedSupplierId, { transaction });
            if (!supplierRecord) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: `Supplier not found: ${parsedSupplierId}` });
            }

            if (Number(supplierRecord.supplier_status_id) !== 1) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Cannot update GRN — Supplier "${supplierRecord.name}" is inactive.`,
                });
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
            nextStatusName = normalizeStatusName(status);
        }

        const grnStatusColumn = await hasGrnColumn('grn_status_id')
            ? 'grn_status_id'
            : (await hasGrnColumn('po_status_id') ? 'po_status_id' : null);

        if (grnStatusColumn) {
            const requestedGrnStatusId = parsePositiveInt(grn_status_id);
            if (requestedGrnStatusId) {
                const requestedStatusName = await getGrnStatusNameById(requestedGrnStatusId, transaction);
                if (!requestedStatusName) {
                    await transaction.rollback();
                    return res.status(400).json({ success: false, message: 'Invalid grn_status_id' });
                }

                grnRecord[grnStatusColumn] = requestedGrnStatusId;
                nextStatusName = requestedStatusName;
            } else if (po_status_id !== undefined) {
                const mappedFromPoStatus = await mapPoStatusIdToGrnStatusId(po_status_id, transaction);
                if (!mappedFromPoStatus) {
                    await transaction.rollback();
                    return res.status(400).json({ success: false, message: 'Invalid po_status_id for GRN status mapping' });
                }

                const mappedStatusName = await getGrnStatusNameById(mappedFromPoStatus, transaction);
                if (!mappedStatusName) {
                    await transaction.rollback();
                    return res.status(400).json({ success: false, message: 'Invalid GRN status mapping from po_status_id' });
                }

                grnRecord[grnStatusColumn] = mappedFromPoStatus;
                nextStatusName = mappedStatusName;
            } else if (status !== undefined) {
                const requestedStatusByName = await getGrnStatusIdByName([status], transaction);
                if (!requestedStatusByName) {
                    await transaction.rollback();
                    return res.status(400).json({ success: false, message: `Unknown GRN status: ${status}` });
                }

                grnRecord[grnStatusColumn] = requestedStatusByName;
                nextStatusName = normalizeStatusName(status);
            }
        }

        const nextIsCancelled = isCancelledStatus(nextStatusName);
        if (nextIsCancelled && hasReplacementItems) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Cannot replace GRN items while cancelling GRN',
            });
        }

        if (nextIsCancelled) {
            for (const existingItem of grnRecord.grn_items || []) {
                const revertResult = await applyItemStockChange(existingItem.item_id, -getRowQuantityValue(existingItem), transaction);
                if (!revertResult.success) {
                    await transaction.rollback();
                    return res.status(revertResult.status).json({ success: false, message: revertResult.message });
                }
            }
        }

        if (hasReplacementItems && !nextIsCancelled) {
            const existingItems = grnRecord.grn_items || [];

            for (const existingItem of existingItems) {
                const revertResult = await applyItemStockChange(existingItem.item_id, -getRowQuantityValue(existingItem), transaction);
                if (!revertResult.success) {
                    await transaction.rollback();
                    return res.status(revertResult.status).json({ success: false, message: revertResult.message });
                }
            }

            await GrnItem.destroy({ where: { grn_id: grnRecord.id }, transaction });

            let recomputedTotal = 0;
            for (const row of replacementItems) {
                const itemId = parsePositiveInt(row.item_id);
                const quantities = parseGrnItemQuantities(row);
                const purchasePrice = parseNonNegativeNumber(row.purchase_price);

                if (!itemId || !quantities || purchasePrice === null) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'Each GRN item needs valid item_id, quantities (use quantity or total_quantity/recieved_quantity), and purchase_price (>= 0)',
                    });
                }

                const itemExists = await Item.findByPk(itemId, { transaction });
                if (!itemExists) {
                    await transaction.rollback();
                    return res.status(404).json({ success: false, message: `Item not found: ${itemId}` });
                }

                await GrnItem.create(buildGrnItemPayload(grnItemColumns, {
                    grnId: grnRecord.id,
                    itemId,
                    totalQuantity: quantities.totalQuantity,
                    receivedQuantity: quantities.receivedQuantity,
                    purchasePrice,
                }), { transaction });

                const stockResult = await applyItemStockChange(itemId, quantities.receivedQuantity, transaction);
                if (!stockResult.success) {
                    await transaction.rollback();
                    return res.status(stockResult.status).json({ success: false, message: stockResult.message });
                }

                await createGrnStockMovement({
                    itemId,
                    grnId: grnRecord.id,
                    userId: grnRecord.user_id,
                    quantity: quantities.receivedQuantity,
                    transaction,
                });

                recomputedTotal += quantities.receivedQuantity * purchasePrice;
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
            include: [
                { model: GrnItem, as: 'grn_items' },
                { model: GrnStatus, as: 'grn_status' },
            ],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!grnRecord) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'GRN not found' });
        }

        if (isCancelledStatus(normalizeGrnStatus(grnRecord))) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: 'GRN is already cancelled',
            });
        }

        const purchaseOrderId = grnRecord.purchase_order_id;

        for (const grnItem of grnRecord.grn_items || []) {
            const revertResult = await applyItemStockChange(grnItem.item_id, -getRowQuantityValue(grnItem), transaction);
            if (!revertResult.success) {
                await transaction.rollback();
                return res.status(revertResult.status).json({ success: false, message: revertResult.message });
            }
        }

        const grnStatusColumn = await hasGrnColumn('grn_status_id')
            ? 'grn_status_id'
            : (await hasGrnColumn('po_status_id') ? 'po_status_id' : null);

        if (grnStatusColumn) {
            const cancelledStatusId = await getGrnStatusIdByName(cancelledGrnStatusNames, transaction);
            if (!cancelledStatusId) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Cancelled GRN status is not configured in grn_status table',
                });
            }

            grnRecord[grnStatusColumn] = cancelledStatusId;
        }

        if (await hasGrnColumn('status')) {
            grnRecord.status = 'cancelled';
        }

        await grnRecord.save({ transaction });

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
            message: 'GRN cancelled successfully and stock rolled back',
            cancelled_grn_id: grnId,
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
        const grnItemColumns = await getGrnItemColumns();
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
        const quantities = parseGrnItemQuantities(req.body);
        const purchasePrice = parseNonNegativeNumber(req.body.purchase_price);

        if (!itemId || !quantities || purchasePrice === null) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Valid item_id, quantities (use quantity or total_quantity/recieved_quantity), and purchase_price (>= 0) are required',
            });
        }

        const itemExists = await Item.findByPk(itemId, { transaction });
        if (!itemExists) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: `Item not found: ${itemId}` });
        }

        const grnItem = await GrnItem.create(buildGrnItemPayload(grnItemColumns, {
            grnId,
            itemId,
            totalQuantity: quantities.totalQuantity,
            receivedQuantity: quantities.receivedQuantity,
            purchasePrice,
        }), { transaction });

        const stockResult = await applyItemStockChange(itemId, quantities.receivedQuantity, transaction);
        if (!stockResult.success) {
            await transaction.rollback();
            return res.status(stockResult.status).json({ success: false, message: stockResult.message });
        }

        await createGrnStockMovement({
            itemId,
            grnId,
            userId: grnRecord.user_id,
            quantity: quantities.receivedQuantity,
            transaction,
        });

        grnRecord.total_amount = (Number(grnRecord.total_amount) || 0) + (quantities.receivedQuantity * purchasePrice);
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
                quantity: getRowQuantityValue(row),
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
        const grnItemColumns = await getGrnItemColumns();
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
                ...buildGrnItemPayload(grnItemColumns, {
                    grnId: grnRecord.id,
                    itemId,
                    totalQuantity: quantity,
                    receivedQuantity: quantity,
                    purchasePrice,
                }),
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