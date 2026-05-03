const { models } = require('../config/db');
//const category = require('../models/category');
const { user_role, user_status, category, item_status, po_status, user, supplier, grn_status } = models;

const getAllUserRoles = async (req, res) => {
    try {
        const items = await user_role.findAll();

        const data = items.map((item) => {
            return {
                "id": item.id,
                "name": item.name,
            };
        });

        return res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllUserStatuses = async (req, res) => {
    try {
        const items = await user_status.findAll();
        const data = items.map((item) => {
            return {
                "id": item.id,
                "name": item.name,
            };
        });

        return res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


const getAllCategories = async (req, res) => {
    try {
        const categories = await category.findAll();

        const data = categories.map((item) => {
            return {
                "id": item.id,
                "name": item.name,
            };
        });

        return res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllItemStatuses = async (req, res) => {
    try {
        const statuses = await item_status.findAll();

        const data = statuses.map((item) => {
            return {
                "id": item.id,
                "name": item.name,
            };
        });

        return res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllPoStatuses = async (req, res) => {
    try {
        const statuses = await po_status.findAll();

        const data = statuses.map((item) => {
            return {
                "id": item.id,
                "name": item.name,
            };
        });

        return res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllGrnStatuses = async (req, res) => {
    try {
        const statuses = await grn_status.findAll();

        const data = statuses.map((item) => {
            return {
                "id": item.id,
                "name": item.name,
            };
        });

        return res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const statuses = await user.findAll();

        const data = statuses.map((item) => {
            return {
                "id": item.id,
                "name": item.name,
            };
        });

        return res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllSuppliers = async (req, res) => {
    try {
        const statuses = await supplier.findAll();

        const data = statuses.map((item) => {
            return {
                "id": item.id,
                "name": item.name,
                "supplier_status_id": item.supplier_status_id,
            };
        });

        return res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllUserRoles,
    getAllUserStatuses,
    getAllCategories,
    getAllItemStatuses,
    getAllPoStatuses,
    getAllUsers,
    getAllSuppliers,
    getAllGrnStatuses
};