const express = require('express');
const { registerUser, loginUser, getProfile } = require('../controllers/UserController');
const authUser = require('../middlewares/AuthUser');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/get-profile', authUser, getProfile);

module.exports = router;