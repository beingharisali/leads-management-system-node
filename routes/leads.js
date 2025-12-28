const express = require("express");
const router = express.Router();

const {
	createLead,
	getLeads,
	getLeadsByDate,
	getSingleLead,
	updateLead,
	deleteLead,
	updateLeadStatus,
	getAllLeads,
	getLeadsByCSR,
} = require("../controllers/leads");

const { auth, authorizeRoles } = require("../middleware/authentication");

// CSR routes (authenticated users only)
router.get("/get-leads", auth, getLeads);
router.get("/get-leads-by-date", auth, getLeadsByDate);
router.post("/create-leads", auth, createLead);
router.get("/get-single-leads/:id", auth, getSingleLead);
router.patch("/update-leads/:id", auth, updateLead);
router.patch("/update-lead-status/:id", auth, updateLeadStatus);
router.delete("/delete-leads/:id", auth, deleteLead);

// Admin routes (only admin can access)
router.get("/get-all-leads", auth, authorizeRoles("admin"), getAllLeads);
router.get("/get-leads-by-csr/:csrId", auth, authorizeRoles("admin"), getLeadsByCSR);

module.exports = router;
