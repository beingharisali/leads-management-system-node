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
            msg: "You are not logged in. Please log in to continue.",
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
                msg: "Your session is invalid. Please log in again.",
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
        let message = "Your session is invalid. Please log in again.";
        if (error.name === "TokenExpiredError") message = "Your session has expired. Please log in again.";

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
                msg: "You are not logged in. Please log in to continue.",
            });
        }

        // Role check (Admin bypass check)
        if (!roles.includes(req.user.role)) {
            console.warn(`SECURITY ALERT: User ${req.user.email} tried to access an Admin route.`);
            return res.status(403).json({
                success: false,
                msg: "You do not have permission to perform this action.",
            });
        }

        next();
    };
};

module.exports = { auth, authorizeRoles };