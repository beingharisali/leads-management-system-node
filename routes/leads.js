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
	uploadLeads,       // Task 24
	bulkInsertLeads,   // Task 26
} = require("../controllers/leads");

const { parseExcelFile } = require("../controllers/parseExcel"); // Task 25
const { auth, authorizeRoles } = require("../middleware/authentication");
const upload = require("../middleware/upload"); // Task 24: Multer

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
	upload.single("file"),
	uploadLeads
);

// ----------------- Task 25: Parse Excel File -----------------
router.post(
	"/parse-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	parseExcelFile
);

// ----------------- Task 26: Bulk Insert Leads from Excel -----------------
router.post(
	"/bulk-insert-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	bulkInsertLeads
);

module.exports = router;
