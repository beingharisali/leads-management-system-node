const express = require("express");
const router = express.Router();

const {
	createLead,
	getLeads,
	getSingleLead,
	updateLead,
	deleteLead,
} = require("../controllers/leads");

const authenticateUser = require("../middleware/authentication");

router.get("/get-leads", authenticateUser, getLeads);

router.post("/create-leads", authenticateUser, createLead);

router.get("/get-single-leads/:id", authenticateUser, getSingleLead);

router.patch("/update-leads/:id", authenticateUser, updateLead);
router.delete("/delete-leads/:id", authenticateUser, deleteLead);

module.exports = router;
