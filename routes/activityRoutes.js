const express = require("express");
const router = express.Router();

const { heartbeat, getCsrActivity, getMyActivity, getAllCsrPresence } = require("../controllers/activity");
const { auth, authorizeRoles } = require("../middleware/authentication");

// CSR portal pings this while the window is visible
router.post("/heartbeat", auth, authorizeRoles("csr"), heartbeat);

// CSR: their own portal time today (the timer on their dashboard)
router.get("/me", auth, authorizeRoles("csr"), getMyActivity);

// Admin only: every CSR's online status (sidebar) and one CSR's portal
// time with monthly history (agent page).
router.get("/presence", auth, authorizeRoles("admin"), getAllCsrPresence);
router.get("/csr/:csrId", auth, authorizeRoles("admin"), getCsrActivity);

module.exports = router;
