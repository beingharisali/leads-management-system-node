const express = require('express');
const router = express.Router();

const {
    firstAdminSignup,
    register,
    login,
    updateUser,
} = require('../controllers/auth');

const { auth } = require('../middleware/authentication');
const asyncWrapper = require('../middleware/async');

// ===== FIRST ADMIN SIGNUP =====
router.post('/first-admin-signup', asyncWrapper(firstAdminSignup));

// ===== REGISTER (ADMIN ONLY) =====
router.post('/register', auth, asyncWrapper(register));

// ===== LOGIN =====
router.post('/login', asyncWrapper(login));

// ===== UPDATE PROFILE =====
router.put('/updateUser', auth, asyncWrapper(updateUser));

module.exports = router;
