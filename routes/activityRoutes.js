const express = require("express");
const router = express.Router();

const { heartbeat, getCsrActivity, getAllCsrPresence } = require("../controllers/activity");
const { auth, authorizeRoles } = require("../middleware/authentication");

// CSR portal pings this while the window is visible
router.post("/heartbeat", auth, authorizeRoles("csr"), heartbeat);

// Admin only: every CSR's online status (sidebar) and one CSR's portal
// time (agent page). The CSR never sees either.
router.get("/presence", auth, authorizeRoles("admin"), getAllCsrPresence);
router.get("/csr/:csrId", auth, authorizeRoles("admin"), getCsrActivity);

module.exports = router;
