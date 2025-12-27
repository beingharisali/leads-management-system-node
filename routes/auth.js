const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/authentication'); // updated middleware
const { register, login, updateUser } = require('../controllers/auth');
const rateLimiter = require('express-rate-limit');

const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: {
    msg: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Register new admin user (server-side role set in controller)
router.post('/register', apiLimiter, register);

// Login existing user
router.post('/login', apiLimiter, login);

// Update logged-in user profile
router.patch('/updateUser', auth, updateUser);

module.exports = router;
