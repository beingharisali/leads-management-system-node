const express = require("express");
const router = express.Router();

// Controllers
const {
    getCsrDashboardStats,
    getAdminDashboardStats
} = require("../controllers/dashboardController");

// Middleware
const { auth, authorizeRoles } = require("../middleware/authentication");

// ================= CSR Dashboard =================
router.get(
    "/csr-stats",
    auth,
    authorizeRoles("csr"),   // CSR-only access
    getCsrDashboardStats
);

// ================= Admin Dashboard =================
router.get(
    "/admin-stats",
    auth,
    authorizeRoles("admin"),  // Admin-only access
    getAdminDashboardStats
);

module.exports = router;
