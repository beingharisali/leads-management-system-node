const express = require("express");
const router = express.Router();

// Controllers
const {
    getCsrDashboardStats,
    getAdminDashboardStats,
    getCsrPerformanceComparison  // ✅ added for LEADS-SYSTEM-33
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

// ================= Admin: CSR Performance Comparison =================
router.get(
    "/csr-performance",
    auth,
    authorizeRoles("admin"),  // Admin-only access
    getCsrPerformanceComparison
);

module.exports = router;
