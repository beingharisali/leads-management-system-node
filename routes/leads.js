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

const authenticateUser = require("../middleware/authentication");

// CSR routes
router.get("/get-leads", authenticateUser, getLeads);
router.get("/get-leads-by-date", authenticateUser, getLeadsByDate);
router.post("/create-leads", authenticateUser, createLead);
router.get("/get-single-leads/:id", authenticateUser, getSingleLead);
router.patch("/update-leads/:id", authenticateUser, updateLead);
router.patch("/update-lead-status/:id", authenticateUser, updateLeadStatus);
router.delete("/delete-leads/:id", authenticateUser, deleteLead);

// Admin routes
router.get("/get-all-leads", authenticateUser, getAllLeads);
router.get("/get-leads-by-csr/:csrId", authenticateUser, getLeadsByCSR);

module.exports = router;
