const { models } = require('../config/db');
const { Op } = require('sequelize');

const { customer: Customer, sale: Sale } = models;

const createCustomer = async (req, res) => {
    try {
        const { name, phone } = req.body;

        if (!name || (name && name.trim() === '')) {
            return res.status(400).json({ success: false, message: 'Customer name is required' });
        }

        if (!phone || (phone && phone.trim() === '')) {
            return res.status(400).json({ success: false, message: 'Customer phone number is required' });
        }

        const normalizedPhone = phone.trim();
        const existingCustomerPhone = await Customer.findOne({ where: { phone: normalizedPhone } });
        if (existingCustomerPhone) {
            return res.status(409).json({ success: false, message: 'Customer with this phone number already exists' });
        }

        const newCustomer = await Customer.create({
            name: name.trim(),
            phone: normalizedPhone
        });

        return res.status(201).json({
            success: true,
            message: 'Customer registered successfully',
            customer: newCustomer
        });
    } catch (error) {
        console.error('Error creating customer:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllCustomers = async (req, res) => {
    try {
        const customers = await Customer.findAll({
            order: [['name', 'ASC']]
        });

        return res.json({
            success: true,
            customers
        });
    } catch (error) {
        console.error('Error fetching customers:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getCustomer = async (req, res) => {
    try {
        const customerId = req.params.id;

        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }

        const customer = await Customer.findByPk(customerId);

        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        return res.json({
            success: true,
            customer
        });
    } catch (error) {
        console.error('Error fetching customer:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const searchCustomers = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.trim() === '') {
            return res.status(400).json({ success: false, message: 'Search query is required' });
        }

        const searchQuery = `%${query.trim()}%`;

        const customers = await Customer.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: searchQuery } },
                    { phone: { [Op.like]: searchQuery } }
                ]
            },
            limit: 10
        });

        return res.json({
            success: true,
            customers
        });
    } catch (error) {
        console.error('Error searching customers:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const updateCustomer = async (req, res) => {
    try {
        const customerId = req.params.id;
        const { name, phone } = req.body;

        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }

        const customer = await Customer.findByPk(customerId);

        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const nextPhone = phone !== undefined ? phone.trim() : customer.phone;

        if (nextPhone && nextPhone !== customer.phone) {
            const existingPhone = await Customer.findOne({ where: { phone: nextPhone, id: { [Op.ne]: customerId } } });
            if (existingPhone) {
                return res.status(409).json({ success: false, message: 'Phone number already exists' });
            }
        }

        await customer.update({
            name: name !== undefined ? name.trim() : customer.name,
            phone: phone !== undefined ? phone.trim() : customer.phone
        });

        return res.json({
            success: true,
            message: 'Customer updated successfully',
            customer
        });
    } catch (error) {
        console.error('Error updating customer:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deleteCustomer = async (req, res) => {
    try {
        const customerId = req.params.id;

        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }

        const customer = await Customer.findByPk(customerId);

        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        // Check if customer has any associated sales
        const associatedSales = await Sale.count({
            where: { customer_id: customerId }
        });

        if (associatedSales > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete customer with ${associatedSales} associated sale(s). Please archive or reassign the sales first.`
            });
        }

        await customer.destroy();

        return res.json({
            success: true,
            message: 'Customer deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting customer:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createCustomer,
    getAllCustomers,
    getCustomer,
    searchCustomers,
    updateCustomer,
    deleteCustomer
};
