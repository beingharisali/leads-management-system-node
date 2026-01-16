const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');

// Create first admin
router.post('/first-admin', async (req, res) => {
    try {
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Admin already exists' });
        }

        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Please provide all values' });
        }

        const user = await User.create({ name, email, password, role: 'admin' });

        res.status(StatusCodes.CREATED).json({
            msg: `Admin ${user.name} created successfully!`,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ msg: error.message });
    }
});

module.exports = router;
