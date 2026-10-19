// middleware/authentication.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Staff accounts only use the task portal. Many lead / sale controllers treat
// "not a CSR" as "admin" (and return everyone's data), so staff are kept out
// of every API except these, here in one place, rather than route by route.
const STAFF_ALLOWED_PATHS = [
    "/api/v1/tasks",
    "/api/v1/notifications",
    "/api/v1/auth/me",
    "/api/v1/auth/updateUser",
];

const pathOf = (url) => String(url || "").split("?")[0];
const underAny = (path, prefixes) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

const staffMayUse = (url) => underAny(pathOf(url), STAFF_ALLOWED_PATHS);

// Admin sections a staff member can be given (User.permissions). Inside a
// section they are treated as the admin, so the existing admin code serves
// them unchanged. Things only the real admin may do are guarded with
// `realAdminOnly` on their routes.
const STAFF_SECTIONS = [
    {
        permission: "leads",
        paths: ["/api/v1/lead", "/api/v1/dashboard", "/api/v1/sale", "/api/v1/activity/presence", "/api/v1/activity/csr"],
    },
    // A CSR's profile card on their dashboard (changing the numbers needs "accounts")
    { permission: "leads", paths: ["/api/v1/auth/agent"], methods: ["GET"] },
    {
        permission: "accounts",
        paths: ["/api/v1/auth/register", "/api/v1/auth/update-status", "/api/v1/auth/agent", "/api/v1/auth/team-members", "/api/v1/auth/accounts"],
    },
    // Only from the admin task pages (they send "X-Portal: admin"); in the
    // staff portal the same person still sees just their own tasks.
    { permission: "tasks", paths: ["/api/v1/tasks"], adminPortalOnly: true },
];

const staffSectionAccess = (req, permissions) => {
    const path = pathOf(req.originalUrl);
    const fromAdminPortal = String(req.headers["x-portal"] || "").toLowerCase() === "admin";
    return STAFF_SECTIONS.some((s) =>
        permissions.includes(s.permission)
        && underAny(path, s.paths)
        && (!s.methods || s.methods.includes(req.method))
        && (!s.adminPortalOnly || fromAdminPortal)
    );
};

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
    } catch (error) {
        // 5. Specific Error Handling
        let message = "Your session is invalid. Please log in again.";
        if (error.name === "TokenExpiredError") message = "Your session has expired. Please log in again.";

        return res.status(401).json({
            success: false,
            msg: message,
        });
    }

    // 6. The account must still exist (the admin can delete accounts), and
    // its permissions are read fresh so changes apply straight away.
    const account = await User.findById(req.user.userId).select("permissions").lean();
    if (!account) {
        return res.status(401).json({
            success: false,
            msg: "Your account no longer exists. Please contact Admin.",
        });
    }
    req.user.permissions = account.permissions || [];

    if (req.user.role === "staff") {
        if (staffSectionAccess(req, req.user.permissions)) {
            req.user.role = "admin";
            req.user.staffAccess = true; // acting as admin through a permission
        } else if (!staffMayUse(req.originalUrl)) {
            return res.status(403).json({
                success: false,
                msg: "You do not have permission to perform this action.",
            });
        }
    }

    next();
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

/**
 * Only the real admin account - not a staff member with admin access
 * (deleting accounts, changing access, deleting all leads).
 */
const realAdminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== "admin" || req.user.staffAccess) {
        return res.status(403).json({
            success: false,
            msg: "Only the admin can do this.",
        });
    }
    next();
};

module.exports = { auth, authorizeRoles, realAdminOnly };