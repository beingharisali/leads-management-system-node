// middleware/authentication.js
const jwt = require("jsonwebtoken");

/**
 * ======================
 * AUTHENTICATION
 * ======================
 * JWT verify karta hai
 * aur user info req.user mein attach karta hai
 */
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      msg: "Authentication token missing",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ JWT se user info attach
    req.user = {
      userId: payload.userId,
      role: payload.role,
      name: payload.name,
      email: payload.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      msg: "Authentication failed",
    });
  }
};

/**
 * ======================
 * AUTHORIZATION (ROLES)
 * ======================
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        msg: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        msg: "Access denied",
      });
    }

    next();
  };
};

module.exports = { auth, authorizeRoles };
