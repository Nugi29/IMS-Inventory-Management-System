const jwt = require('jsonwebtoken');

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
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

module.exports = authUser;