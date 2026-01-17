const express = require("express");
const router = express.Router();

// Controllers
const {
    getCsrDashboardStats,
    getAdminDashboardStats,
    getCsrPerformanceComparison
} = require("../controllers/dashboardController");

// Middleware
const { auth, authorizeRoles } = require("../middleware/authentication");

// ================= CSR Dashboard =================
router.get("/csr-stats", auth, authorizeRoles("csr"), getCsrDashboardStats);

// ================= Admin Dashboard =================
router.get("/admin-stats", auth, authorizeRoles("admin"), getAdminDashboardStats);

// ================= Admin: CSR Performance Comparison =================
router.get("/csr-performance", auth, authorizeRoles("admin"), getCsrPerformanceComparison);

module.exports = router;
