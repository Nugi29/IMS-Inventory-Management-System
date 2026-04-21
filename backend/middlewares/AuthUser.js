const jwt = require('jsonwebtoken');
const { models } = require('../config/db');

const { user: User } = models;

// user authentication middleware
const authUser = async (req, res, next) => {
    try {
        const tokenFromHeader = req.headers.authorization;
        const token = req.headers.token || (tokenFromHeader && tokenFromHeader.startsWith('Bearer ') ? tokenFromHeader.slice(7) : null);

        if (!token) {
            return res.json({ success: false, message: "Unauthorized Access.. Log in again" });
        }

        const token_decode = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');

        // Initialize req.body if it's undefined (common in GET requests)
        if (!req.body) {
            req.body = {};
        }

        req.body.userId = token_decode.id;
        req.userId = token_decode.id;

        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please log in again.',
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. Please log in again.',
            });
        }

        console.log(error);
        return res.status(500).json({ success: false, message: 'Authentication failed' });
    }
};

const requireAdmin = async (req, res, next) => {
    try {
        const requesterId = req.userId || (req.body && req.body.userId);
        if (!requesterId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const requester = await User.findByPk(requesterId);
        if (!requester) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const requesterRole = await requester.getRole({ attributes: ['name'] });
        const isAdmin = requesterRole && String(requesterRole.name).toLowerCase() === 'admin';
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: 'Only admin can perform this action' });
        }

        next();
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = authUser;
module.exports.requireAdmin = requireAdmin;