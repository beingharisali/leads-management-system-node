const express = require("express");
const router = express.Router();

const {
	createLead,
	getLeads,
	getLeadsByDate, // new function for date filter
	getSingleLead,
	updateLead,
	deleteLead,
} = require("../controllers/leads");

const authenticateUser = require("../middleware/authentication");


router.get("/get-leads", authenticateUser, getLeads);
router.get("/get-leads-by-date", authenticateUser, getLeadsByDate);
router.get("/get-single-leads/:id", authenticateUser, getSingleLead);
router.post("/create-leads", authenticateUser, createLead);
router.patch("/update-leads/:id", authenticateUser, updateLead);
router.delete("/delete-leads/:id", authenticateUser, deleteLead);

module.exports = router;
