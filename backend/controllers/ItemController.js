const { models } = require('../config/db');

const { item: Item, category: Category, supplier: Supplier, item_status: ItemStatus } = models;

const createItem = async (req, res) => {
    try {
        let { name, code, selling_price, quantity, reorder_level, category_id, supplier_id, item_status_id, item_name, sku, barcode } = req.body;
        
        name = name || item_name;
        code = code || sku || barcode;

        if (!name || !selling_price) {
            return res.status(400).json({ success: false, message: 'Name and selling_price are required' });
        }

        if (isNaN(selling_price) || selling_price <= 0) {
            return res.status(400).json({ success: false, message: 'Selling price must be a positive number' });
        }

        if (code) {
            const existingItem = await Item.findOne({ where: { code } });
            if (existingItem) {
                return res.status(409).json({ success: false, message: 'Item code already exists' });
            }
        }

        const createdItem = await Item.create({
            name,
            code: code || null,
            selling_price: Number(selling_price),
            quantity: quantity ? Number(quantity) : 0,
            reorder_level: reorder_level ? Number(reorder_level) : 10,
            category_id: category_id ? Number(category_id) : null,
            supplier_id: supplier_id ? Number(supplier_id) : null,
            item_status_id: item_status_id ? Number(item_status_id) : 1,
        });

        return res.status(201).json({ success: true, item: createdItem });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getItem = async (req, res) => {
    try {
        const itemId = req.params.id || req.body.item_id;
        if (!itemId) {
            return res.status(400).json({ success: false, message: 'Item id is required' });
        }

        const itemData = await Item.findByPk(itemId);

        if (!itemData) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const modItemData = {
            id: itemData.id,
            name: itemData.name,
            code: itemData.code,
            selling_price: itemData.selling_price,
            quantity: itemData.quantity,
            reorder_level: itemData.reorder_level,
            category_id: itemData.category_id,
            supplier_id: itemData.supplier_id,
            item_status_id: itemData.item_status_id,
            createdAt: itemData.createdAt,
            updatedAt: itemData.updatedAt,
        };

        return res.json({ success: true, itemData: modItemData });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllItems = async (req, res) => {
    try {
        const items = await Item.findAll({
            include: [
                { model: Category, as: 'category' },
                { model: Supplier, as: 'supplier' }
            ]
        });

        const itemsData = items.map((itemData) => {
            const quantity = Number(itemData.quantity) || 0;
            const reorderLevel = Number(itemData.reorder_level) || 10;
            let stock_status = 'In Stock';
            if (quantity <= 0) stock_status = 'Out of Stock';
            else if (quantity <= reorderLevel) stock_status = 'Low';

            return {
                id: itemData.id,
                item_name: itemData.name,
                sku: itemData.code,
                barcode: itemData.code,
                selling_price: itemData.selling_price,
                current_stock: quantity,
                reorder_level: reorderLevel,
                category_id: itemData.category_id,
                supplier_id: itemData.supplier_id,
                item_status_id: itemData.item_status_id,
                category: itemData.category || null,
                supplier: itemData.supplier || null,
                stock_status: stock_status,
                createdAt: itemData.createdAt,
                updatedAt: itemData.updatedAt,
            };
        });

        return res.json({ success: true, itemsData });
    } catch (error) {
        console.error('getAllItems error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const applyItemUpdates = async (itemData, fields) => {
    let { name, code, selling_price, quantity, reorder_level, category_id, supplier_id, item_status_id, item_name, sku, barcode } = fields;

    name = name || item_name;
    code = code || sku || barcode;

    if (name) {
        itemData.name = name;
    }

    if (code && code !== itemData.code) {
        const existingItem = await Item.findOne({ where: { code } });
        if (existingItem && existingItem.id !== itemData.id) {
            return { success: false, status: 409, message: 'Item code already exists' };
        }
        itemData.code = code;
    }

    if (selling_price !== undefined) {
        if (isNaN(selling_price) || selling_price <= 0) {
            return { success: false, status: 400, message: 'Selling price must be a positive number' };
        }
        itemData.selling_price = Number(selling_price);
    }

    if (quantity !== undefined) {
        itemData.quantity = Number(quantity);
    }

    if (reorder_level !== undefined) {
        itemData.reorder_level = Number(reorder_level);
    }

    if (category_id !== undefined) {
        itemData.category_id = category_id ? Number(category_id) : null;
    }

    if (supplier_id !== undefined) {
        itemData.supplier_id = supplier_id ? Number(supplier_id) : null;
    }

    if (item_status_id !== undefined) {
        itemData.item_status_id = Number(item_status_id);
    }

    await itemData.save();
    return { success: true };
};

const updateItem = async (req, res) => {
    try {
        const itemId = req.params.id || req.body.item_id;
        if (!itemId) {
            return res.status(400).json({ success: false, message: 'Item id is required' });
        }

        const { name, code, selling_price, quantity, reorder_level, category_id, supplier_id, item_status_id, item_name, sku, barcode } = req.body;

        const itemData = await Item.findByPk(itemId);
        if (!itemData) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const updateResult = await applyItemUpdates(itemData, {
            name,
            code,
            selling_price,
            quantity,
            reorder_level,
            category_id,
            supplier_id,
            item_status_id,
            item_name,
            sku,
            barcode,
        });

        if (!updateResult.success) {
            return res.status(updateResult.status).json({ success: false, message: updateResult.message });
        }

        return res.json({
            success: true,
            message: 'Item updated successfully',
            updated_item_id: itemData.id,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deleteItem = async (req, res) => {
    try {
        const itemId = req.params.id || req.body.item_id;
        if (!itemId) {
            return res.status(400).json({ success: false, message: 'Item id is required' });
        }

        const itemData = await Item.findByPk(itemId);
        if (!itemData) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        await itemData.destroy();

        return res.json({
            success: true,
            message: 'Item deleted successfully',
            deleted_item_id: itemId,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createItem,
    getItem,
    getAllItems,
    updateItem,
    deleteItem,
};
