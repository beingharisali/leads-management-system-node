// middleware/authentication.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { UnauthenticatedError } = require('../errors');

/**
 * Auth Middleware
 * Checks if the request has a valid JWT token
 * and attaches user info (userId & role) to req.user
 */
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, msg: 'Authentication invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, msg: 'Authentication invalid' });
    }

    // attach user info to request
    req.user = { userId: user._id, role: user.role };
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ success: false, msg: 'Authentication invalid' });
  }
};

/**
 * Role-based Authorization Middleware
 * Accepts multiple roles
 * Example: authorizeRoles('admin', 'csr')
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, msg: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        msg: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = { auth, authorizeRoles };
