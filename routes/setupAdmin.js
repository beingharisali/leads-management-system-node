const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const jwt = require('jsonwebtoken');

// Helper function to create JWT
const createJWT = (user) => {
    return jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_LIFETIME || '1d' }
    );
};

// Create first admin
router.post('/first-admin', async (req, res) => {
    try {
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Admin already exists. Please login.' });
        }

        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Please provide all values' });
        }

        const user = await User.create({ name, email, password, role: 'admin' });
        const token = createJWT(user); // JWT token

        res.status(StatusCodes.CREATED).json({
            msg: `Admin ${user.name} created successfully!`,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
            token, // send token to frontend
        });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ msg: error.message });
    }
});

module.exports = router;
