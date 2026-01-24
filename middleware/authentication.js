// middleware/authentication.js
const jwt = require("jsonwebtoken");

/**
 * ======================
 * AUTHENTICATION MIDDLEWARE
 * ======================
 * Token verify karta hai aur user payload attach karta hai
 */
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1. Header Check
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      msg: "Access Denied: No token provided",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 2. JWT Verify
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Payload Check: Ensure role and userId exist in token
    if (!payload.role || !payload.userId) {
      return res.status(401).json({
        success: false,
        msg: "Invalid token structure: Missing role or ID",
      });
    }

    // 4. Attach User to Request Object
    req.user = {
      userId: payload.userId,
      role: payload.role.toLowerCase().trim(), // Normalizing role
      name: payload.name,
      email: payload.email,
    };

    next();
  } catch (error) {
    // 5. Specific Error Handling
    let message = "Authentication failed";
    if (error.name === "TokenExpiredError") message = "Session expired. Please login again.";
    if (error.name === "JsonWebTokenError") message = "Invalid token. Security alert!";

    return res.status(401).json({
      success: false,
      msg: message,
    });
  }
};

/**
 * ======================
 * AUTHORIZATION MIDDLEWARE
 * ======================
 * Role check karta hai (e.g., Only 'admin' can pass)
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Check if user object exists
    if (!req.user) {
      return res.status(401).json({
        success: false,
        msg: "Authorization failed: User info not found",
      });
    }

    // Role check (Admin bypass check)
    if (!roles.includes(req.user.role)) {
      console.warn(`SECURITY ALERT: User ${req.user.email} tried to access an Admin route.`);
      return res.status(403).json({
        success: false,
        msg: `Forbidden: Your role (${req.user.role}) does not have permission.`,
      });
    }

    next();
  };
};

module.exports = { auth, authorizeRoles };