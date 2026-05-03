const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');
const { sale: Sale, sale_item: SaleItem, item: Item, customer: Customer, user: User, stock_movement: StockMovement } = models;
const { syncItemStatusByQuantity } = require('../utils/itemStatusSync');

const createSale = async (req, res) => {
    try {
        const { customer_id, items, paid_amount } = req.body;
        const user_id = req.userId;

        if (!user_id) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items are required' });
        }

        const transaction = await sequelize.transaction();

        try {
            // Validate all items exist and have sufficient stock
            const dbItems = await Item.findAll({
                where: {
                    id: items.map(item => item.item_id)
                },
                transaction
            });

            if (dbItems.length !== items.length) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'One or more items not found' });
            }

            // Check item status and stock availability
            // item_status_id: 1 = Active, 2 = Inactive, 3 = Discontinued
            const ITEM_STATUS = { ACTIVE: 1, INACTIVE: 2, DISCONTINUED: 3 };

            for (const item of items) {
                const dbItem = dbItems.find(i => i.id === Number(item.item_id));
                if (!dbItem) {
                    await transaction.rollback();
                    return res.status(400).json({ success: false, message: `Item ${item.item_id} not found` });
                }

                // Block selling Inactive or Discontinued items
                const statusId = Number(dbItem.item_status_id);
                if (statusId === ITEM_STATUS.INACTIVE) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Cannot sell item "${dbItem.name}" — it is marked as Inactive.`
                    });
                }
                if (statusId === ITEM_STATUS.DISCONTINUED) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Cannot sell item "${dbItem.name}" — it is Discontinued.`
                    });
                }

                if (Number(dbItem.quantity) < Number(item.quantity)) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for item ${dbItem.name}. Available: ${dbItem.quantity}, Requested: ${item.quantity}`
                    });
                }
            }

            // Calculate total amount
            let total_amount = 0;
            for (const item of items) {
                const dbItem = dbItems.find(i => i.id === Number(item.item_id));
                total_amount += Number(dbItem.selling_price) * Number(item.quantity);
            }

            // Create sale
            const newSale = await Sale.create({
                user_id,
                customer_id: customer_id || null,
                sale_date: new Date(),
                total_amount: Number(total_amount.toFixed(2))
            }, { transaction });

            // Create sale items, update item stock, and record stock movement
            const createdSaleItems = [];
            for (const item of items) {
                const dbItem = dbItems.find(i => i.id === Number(item.item_id));

                // Create sale item
                const saleItem = await SaleItem.create({
                    sale_id: newSale.id,
                    item_id: Number(item.item_id),
                    quantity: Number(item.quantity),
                    selling_price: Number(item.selling_price || dbItem.selling_price)
                }, { transaction });

                // Update item stock
                const newQuantity = Number(dbItem.quantity) - Number(item.quantity);
                dbItem.quantity = newQuantity;
                await dbItem.save({ transaction });

                // Auto-sync item status based on new quantity
                await syncItemStatusByQuantity(dbItem, { transaction });

                // movement_type_id = 2 => sale (stock out), same as removed DB trigger logic
                await StockMovement.create({
                    item_id: Number(item.item_id),
                    quantity: Number(item.quantity),
                    grn_id: null,
                    sale_id: newSale.id,
                    user_id,
                    movement_type_id: 2
                }, { transaction });

                createdSaleItems.push(saleItem);
            }

            await transaction.commit();

            return res.status(201).json({
                success: true,
                message: 'Sale created successfully',
                sale: {
                    ...newSale.dataValues,
                    sale_items: createdSaleItems,
                    amount_paid: Number(paid_amount || 0)
                }
            });
        } catch (txError) {
            await transaction.rollback();
            throw txError;
        }
    } catch (error) {
        console.error('Error creating sale:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllSales = async (req, res) => {
    try {
        const sales = await Sale.findAll({
            include: [
                { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
                {
                    model: SaleItem,
                    as: 'sale_items',
                    include: [{ model: Item, as: 'item', attributes: ['id', 'name', 'code'] }]
                },
                { model: User, as: 'user', attributes: ['id', 'name', 'username'] }
            ],
            order: [['sale_date', 'DESC']]
        });

        return res.json({
            success: true,
            sales
        });
    } catch (error) {
        console.error('Error fetching sales:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getSale = async (req, res) => {
    try {
        const saleId = req.params.id;

        if (!saleId) {
            return res.status(400).json({ success: false, message: 'Sale ID is required' });
        }

        const sale = await Sale.findByPk(saleId, {
            include: [
                { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
                {
                    model: SaleItem,
                    as: 'sale_items',
                    include: [{ model: Item, as: 'item', attributes: ['id', 'name', 'code', 'selling_price'] }]
                },
                { model: User, as: 'user', attributes: ['id', 'name', 'username'] }
            ]
        });

        if (!sale) {
            return res.status(404).json({ success: false, message: 'Sale not found' });
        }

        return res.json({
            success: true,
            sale
        });
    } catch (error) {
        console.error('Error fetching sale:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getSalesByCustomer = async (req, res) => {
    try {
        const customerId = req.params.customerId;

        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }

        const sales = await Sale.findAll({
            where: { customer_id: customerId },
            include: [
                { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
                {
                    model: SaleItem,
                    as: 'sale_items',
                    include: [{ model: Item, as: 'item', attributes: ['id', 'name', 'code'] }]
                },
                { model: User, as: 'user', attributes: ['id', 'name', 'username'] }
            ],
            order: [['sale_date', 'DESC']]
        });

        return res.json({
            success: true,
            sales
        });
    } catch (error) {
        console.error('Error fetching customer sales:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getSalesByDateRange = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({ success: false, message: 'Start date and end date are required' });
        }

        const sales = await Sale.findAll({
            where: {
                sale_date: {
                    [Op.between]: [new Date(start_date), new Date(end_date)]
                }
            },
            include: [
                { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
                {
                    model: SaleItem,
                    as: 'sale_items',
                    include: [{ model: Item, as: 'item', attributes: ['id', 'name', 'code'] }]
                },
                { model: User, as: 'user', attributes: ['id', 'name'] }
            ],
            order: [['sale_date', 'DESC']]
        });

        return res.json({
            success: true,
            sales
        });
    } catch (error) {
        console.error('Error fetching sales by date range:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getSalesReport = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        let whereClause = {};
        if (start_date && end_date) {
            whereClause = {
                sale_date: {
                    [Op.between]: [new Date(start_date), new Date(end_date)]
                }
            };
        }

        const sales = await Sale.findAll({
            where: whereClause,
            include: [
                { model: Customer, as: 'customer', attributes: ['id', 'name'] },
                {
                    model: SaleItem,
                    as: 'sale_items'
                },
                { model: User, as: 'user', attributes: ['id', 'name'] }
            ]
        });

        // Calculate report data
        let totalSales = 0;
        let totalQuantity = 0;
        const salesByUser = {};
        const salesByCustomer = {};

        for (const sale of sales) {
            totalSales += Number(sale.total_amount);

            // Count by user
            if (sale.user) {
                if (!salesByUser[sale.user.name]) {
                    salesByUser[sale.user.name] = { count: 0, amount: 0 };
                }
                salesByUser[sale.user.name].count += 1;
                salesByUser[sale.user.name].amount += Number(sale.total_amount);
            }

            // Count by customer
            if (sale.customer) {
                if (!salesByCustomer[sale.customer.name]) {
                    salesByCustomer[sale.customer.name] = { count: 0, amount: 0 };
                }
                salesByCustomer[sale.customer.name].count += 1;
                salesByCustomer[sale.customer.name].amount += Number(sale.total_amount);
            }

            // Count items
            if (sale.sale_items) {
                for (const item of sale.sale_items) {
                    totalQuantity += Number(item.quantity);
                }
            }
        }

        return res.json({
            success: true,
            report: {
                total_sales: Number(totalSales.toFixed(2)),
                total_quantity_sold: totalQuantity,
                total_transactions: sales.length,
                sales_by_user: salesByUser,
                sales_by_customer: salesByCustomer,
                average_transaction: Number((totalSales / sales.length || 0).toFixed(2))
            }
        });
    } catch (error) {
        console.error('Error generating sales report:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createSale,
    getAllSales,
    getSale,
    getSalesByCustomer,
    getSalesByDateRange,
    getSalesReport
};
