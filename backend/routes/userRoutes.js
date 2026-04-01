const express = require('express');
const { registerUser, loginUser, getProfile, getAllProfiles } = require('../controllers/UserController');
const authUser = require('../middlewares/AuthUser');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/get-profile', authUser, getProfile);
router.get('/all-profiles', authUser, getAllProfiles);

module.exports = router;