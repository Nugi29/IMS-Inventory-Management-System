const express = require('express');
const { registerUser, loginUser, getProfile, getAllProfiles, updateProfile, adminUpdateUser, adminDeleteUser } = require('../controllers/UserController');
const authUser = require('../middlewares/AuthUser');

const router = express.Router();

router.post('/login', loginUser);
router.get('/get-profile', authUser, getProfile);

router.get('/all-profiles', authUser, getAllProfiles);
router.post('/user-register', registerUser);
router.put('/update-profile', authUser, updateProfile);
router.put('/update-user/:id', authUser, authUser.requireAdmin, adminUpdateUser);
router.delete('/delete/:id', authUser, authUser.requireAdmin, adminDeleteUser);


module.exports = router;