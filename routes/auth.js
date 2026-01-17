const express = require('express');
const router = express.Router();
const { firstAdminSignup, register, login, updateUser } = require('../controllers/auth');
const { auth } = require('../middleware/authentication'); // JWT verify middleware

// ===== FIRST ADMIN SIGNUP =====
router.post('/first-admin-signup', firstAdminSignup);

// ===== REGISTER – Only Admin =====
router.post('/register', auth, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Only admin can create users' });
        }
        await register(req, res);
    } catch (error) {
        next(error);
    }
});

// ===== LOGIN =====
router.post('/login', login);

// ===== UPDATE PROFILE =====
router.put('/updateUser', auth, updateUser);

module.exports = router;
