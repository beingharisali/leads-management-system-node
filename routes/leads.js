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
	uploadLeads,      // Task 24: Controller for Excel upload
} = require("../controllers/leads");

const { parseExcelFile } = require("../controllers/parseExcel"); // Task 25: Parse Excel controller
const { auth, authorizeRoles } = require("../middleware/authentication");
const upload = require("../middleware/upload"); // Task 24: Multer middleware for Excel files

// ----------------- CSR Routes -----------------
router.get("/get-leads", auth, getLeads);
router.get("/get-leads-by-date", auth, getLeadsByDate);
router.post("/create-leads", auth, createLead);
router.get("/get-single-leads/:id", auth, getSingleLead);
router.patch("/update-leads/:id", auth, updateLead);
router.delete("/delete-leads/:id", auth, deleteLead);

// ----------------- Admin Routes -----------------
router.get("/get-all-leads", auth, authorizeRoles("admin"), getAllLeads);
router.get("/get-leads-by-csr/:csrId", auth, authorizeRoles("admin"), getLeadsByCSR);

// ----------------- Task 24: Excel Upload -----------------
router.post(
	"/upload-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"), // Multer middleware
	uploadLeads            // Controller function
);

// ----------------- Task 25: Parse Excel File -----------------
router.post(
	"/parse-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"), // Multer middleware
	parseExcelFile         // Controller function
);

module.exports = router;
