const { models } = require('../config/db');
//const category = require('../models/category');
const { user_role, user_status, category, item_status } = models;

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
        console.log(items);


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
        console.log(categories);


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

module.exports = {
    getAllUserRoles,
    getAllUserStatuses,
    getAllCategories,
    getAllItemStatuses,
};