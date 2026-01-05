const express = require("express");
const router = express.Router();

const {
	createLead,
	getLeads,
	getLeadsByDate,
	getSingleLead,
	updateLead,
	deleteLead,
	getAllLeads,
	getLeadsByCSR,
} = require("../controllers/leads");

const { auth, authorizeRoles } = require("../middleware/authentication");

// =======================
// CSR Routes
// =======================
router.get("/get-leads", auth, getLeads);
router.get("/get-leads-by-date", auth, getLeadsByDate);
router.post("/create-leads", auth, createLead);
router.get("/get-single-leads/:id", auth, getSingleLead);
router.patch("/update-leads/:id", auth, updateLead);
router.delete("/delete-leads/:id", auth, deleteLead);

// =======================
// Admin Routes
// =======================
router.get("/get-all-leads", auth, authorizeRoles("admin"), getAllLeads);
router.get("/get-leads-by-csr/:csrId", auth, authorizeRoles("admin"), getLeadsByCSR);

module.exports = router;
