// middleware/authentication.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { UnauthenticatedError } = require('../errors');

// Auth middleware
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    throw new UnauthenticatedError('Authentication invalid');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select('-password');
    if (!user) {
      throw new UnauthenticatedError('Authentication invalid');
    }

    req.user = { userId: user._id, role: user.role };
    next();
  } catch (error) {
    throw new UnauthenticatedError('Authentication invalid');
  }
};

// Admin-only middleware as higher-order function
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, msg: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, msg: 'Access denied. Admins only.' });
    }
    next();
  };
};

module.exports = { auth, authorizeRoles };
