const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { models } = require('../config/db');

const { user: User } = models;

const registerUser = async (req, res) => {
    try {
        const { username, password, name, role_id, user_status_id } = req.body;
        console.log(req.body);
        

        if (!username || !password || !name) {
            return res.status(400).json({ success: false, message: 'Name, username and password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
        }

        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const createdUser = await User.create({
            name,
            username,
            password: hashedPassword,
            role_id: Number(role_id),
            user_status_id: Number(user_status_id),
        });


        return res.status(201).json({ success: true, user: createdUser });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const existingUser = await User.findOne({ where: { username } });
        if (!existingUser) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const userStatus = await existingUser.getUser_status();
        if (userStatus && (userStatus.name === 'Inactive' || userStatus.name === 'Suspended')) {
            return res.status(403).json({ success: false, message: 'Account is inactive or suspended' });
        }

        const isMatch = await bcrypt.compare(password, existingUser.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const token = jwt.sign(
            { id: existingUser.id },
            process.env.JWT_SECRET || 'dev_secret',
            { expiresIn: '7d' }
        );

        return res.json({ success: true, token });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getUserRoleName = async (userId) => {
    const user = await User.findByPk(userId);
    if (!user) {
        return null;
    }

    const role = await user.getRole({ attributes: ['name'] });
    return role ? String(role.name).toLowerCase() : null;
};

const applyUserUpdates = async (userData, fields) => {
    const { name, username, password, role_id, user_status_id } = fields;

    if (name) {
        userData.name = name;
    }

    if (username && username !== userData.username) {
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser && existingUser.id !== userData.id) {
            return { success: false, status: 409, message: 'Username already exists' };
        }
        userData.username = username;
    }

    if (password) {
        if (password.length < 8) {
            return { success: false, status: 400, message: 'Password must be at least 8 characters long' };
        }
        userData.password = await bcrypt.hash(password, 10);
    }

    if (role_id !== undefined) {
        userData.role_id = Number(role_id);
    }

    if (user_status_id !== undefined) {
        userData.user_status_id = Number(user_status_id);
    }

    await userData.save();
    return { success: true };
};

const getProfile = async (req, res) => {
    try {
        const userId = req.userId || req.body.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const userData = await User.findByPk(userId, {
            attributes: { exclude: ['password'] },
        });

        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const [role, userStatus] = await Promise.all([
            userData.getRole({ attributes: ['id', 'name'] }),
            userData.getUser_status({ attributes: ['id', 'name'] }),
        ]);

        const modUserData = {
            "id": userData.id,
            "name": userData.name,
            "username": userData.username,
            "role": role ? role.toJSON() : null,
            "user_status": userStatus ? userStatus.toJSON() : null,
            "createdAt": userData.createdAt,
        };

        return res.json({ success: true, userData: modUserData });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getAllProfiles = async (req, res) => {
    try {
        const users = await User.findAll({
        });

        const usersData = await Promise.all(users.map(async (userData) => {
            const [role, userStatus] = await Promise.all([
                userData.getRole({ attributes: ['id', 'name'] }),
                userData.getUser_status({ attributes: ['id', 'name'] }),
            ]);

            return {
                "id": userData.id,
                "name": userData.name,
                "username": userData.username,
                "password": userData.password,
                "role": role ? role.toJSON() : null,
                "user_status": userStatus ? userStatus.toJSON() : null,
                "createdAt": userData.createdAt
            };
        }));

        return res.json({ success: true, usersData });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const requesterId = req.userId || req.body.userId;
        if (!requesterId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { name, username, password, role_id, user_status_id, target_user_id } = req.body;

        const requesterRoleName = await getUserRoleName(requesterId);
        if (!requesterRoleName) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const isRequesterAdmin = requesterRoleName === 'admin';

        let targetUserId = Number(requesterId);
        const requestedTargetId = target_user_id !== undefined ? Number(target_user_id) : null;

        if (requestedTargetId && requestedTargetId !== Number(requesterId)) {
            if (!isRequesterAdmin) {
                return res.status(403).json({ success: false, message: 'Only admin can update other users' });
            }

            targetUserId = requestedTargetId;
        }

        if (!isRequesterAdmin && (role_id !== undefined || user_status_id !== undefined)) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can change role or user status',
            });
        }

        const userData = await User.findByPk(targetUserId);
        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const updateResult = await applyUserUpdates(userData, { name, username, password, role_id, user_status_id });
        if (!updateResult.success) {
            return res.status(updateResult.status).json({ success: false, message: updateResult.message });
        }

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            updated_user_id: userData.id,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const adminUpdateUser = async (req, res) => {
    try {
        const requesterId = req.userId || req.body.userId;
        if (!requesterId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const requesterRoleName = await getUserRoleName(requesterId);
        if (requesterRoleName !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only admin can update other users' });
        }

        const targetUserId = Number(req.params.id || req.body.target_user_id);
        if (!targetUserId) {
            return res.status(400).json({ success: false, message: 'Target user id is required' });
        }

        const userData = await User.findByPk(targetUserId);
        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { name, username, password, role_id, user_status_id } = req.body;
        const updateResult = await applyUserUpdates(userData, { name, username, password, role_id, user_status_id });
        if (!updateResult.success) {
            return res.status(updateResult.status).json({ success: false, message: updateResult.message });
        }

        return res.json({
            success: true,
            message: 'User updated successfully by admin',
            updated_user_id: userData.id,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const adminDeleteUser = async (req, res) => {
    try {
        const requesterId = req.userId || req.body.userId;
        if (!requesterId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const requesterRoleName = await getUserRoleName(requesterId);
        if (requesterRoleName !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only admin can delete users' });
        }

        const targetUserId = Number(req.params.id || req.body.target_user_id);
        if (!targetUserId) {
            return res.status(400).json({ success: false, message: 'Target user id is required' });
        }

        if (Number(requesterId) === targetUserId) {
            return res.status(400).json({ success: false, message: 'Admin cannot delete own account' });
        }

        const userData = await User.findByPk(targetUserId);
        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await userData.destroy();

        return res.json({
            success: true,
            message: 'User deleted successfully by admin',
            deleted_user_id: targetUserId,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getProfile,
    getAllProfiles,
    updateProfile,
    adminUpdateUser,
    adminDeleteUser,
};
