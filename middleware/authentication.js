// middleware/authentication.js
const jwt = require("jsonwebtoken");

/**
 * ======================
 * AUTHENTICATION
 * ======================
 * Sirf token verify kare
 * aur userId + role req.user mein daal de
 */
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      msg: "No token provided",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ⚠️ DB call ki zaroorat nahi
    req.user = {
      userId: payload.userId,
      role: payload.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      msg: "Token invalid or expired",
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
