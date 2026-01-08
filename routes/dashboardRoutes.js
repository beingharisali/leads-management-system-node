const express = require("express");
const router = express.Router();
const { getCsrDashboardStats } = require("../controllers/dashboardController");
const { auth, authorizeRoles } = require("../middleware/authentication");
const role = require("../middleware/role");

router.get(
    "/csr-stats",
    auth,
    role("csr"),
    getCsrDashboardStats
);

module.exports = router;
