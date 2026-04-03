const { models } = require('../config/db');
const { user_role, user_status } = models;

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

module.exports = {
    getAllUserRoles,
    getAllUserStatuses,
};