const express = require("express");
const router = express.Router();

// ================= Controllers =================
const { getLeadsGrouped, getSalesGrouped } = require("../controllers/reportController");

// ================= Middleware =================
const { auth, authorizeRoles } = require("../middleware/authentication");

// ================= Routes =================
router.get("/leads", auth, authorizeRoles("admin"), getLeadsGrouped);
router.get("/sales", auth, authorizeRoles("admin"), getSalesGrouped);

module.exports = router;
