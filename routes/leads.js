const express = require("express");
const router = express.Router();
const {
	createLead,
	getLeads,
	updateLead,
	deletLead,
	getSingleLead,
} = require("../controllers/leads");

router.get("/get-leads", getLeads);
router.post("/create-leads", createLead);
router.patch("/update-leads/:id", updateLead);
router.delete("/delete-leads/:id", deletLead);
router.get("get-single-leads/:id", getSingleLead);

module.exports = router;
