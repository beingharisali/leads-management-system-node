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
} = require("../controllers/leads");

const authenticateUser = require("../middleware/authentication");

// CSR routes
router.get("/get-leads", authenticateUser, getLeads);
router.get("/get-leads-by-date", authenticateUser, getLeadsByDate);
router.get("/get-single-leads/:id", authenticateUser, getSingleLead);
router.post("/create-leads", authenticateUser, createLead);
router.patch("/update-leads/:id", authenticateUser, updateLead);
router.patch("/update-leads-status/:id", authenticateUser, updateLeadStatus);
router.delete("/delete-leads/:id", authenticateUser, deleteLead);


router.get("/admin/get-all-leads", authenticateUser, getAllLeads);

module.exports = router;
