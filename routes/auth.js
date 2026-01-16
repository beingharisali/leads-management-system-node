const express = require('express');
const router = express.Router();
const { register, login, updateUser } = require('../controllers/auth');
const { auth } = require('../middleware/authentication'); // authentication middleware

// ================= REGISTER – Only Admin can create users =================
router.post('/register', auth, async (req, res, next) => {
  try {
    // Check if logged-in user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Only admin can create users' });
    }
    // Call controller
    await register(req, res);
  } catch (error) {
    next(error); // centralized error handler
  }
});

// ================= LOGIN =================
router.post('/login', async (req, res, next) => {
  try {
    await login(req, res);
  } catch (error) {
    next(error);
  }
});

// ================= UPDATE PROFILE – Logged-in user =================
router.put('/updateUser', auth, async (req, res, next) => {
  try {
    await updateUser(req, res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
