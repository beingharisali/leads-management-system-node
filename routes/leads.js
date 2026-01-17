const express = require("express");
const router = express.Router();

// ================= Controllers =================
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
	bulkInsertLeads,   // Task 26 + Task 28
} = require("../controllers/leads");

// Excel Controllers
const {
	parseExcelFile,    // Task 25
	validateExcelData, // Task 27
} = require("../controllers/parseExcel");

// Middleware
const { auth, authorizeRoles } = require("../middleware/authentication");
const upload = require("../middleware/upload");

// ================= Validators =================
const {
	createLeadValidator,
	updateLeadValidator,
	getLeadsByDateValidator,
} = require("../middleware/leadValidator");
const validateRequest = require("../middleware/validateRequest");

// ================= CSR Routes ================
// CSR / Admin: Get leads by CSR
router.get("/csr/:csrId", auth, getLeadsByCSR);

// Individual CSR lead fetch
router.get("/get-leads", auth, getLeads);
router.get("/get-leads-by-date", auth, getLeadsByDateValidator, validateRequest, getLeadsByDate);
router.post("/create-leads", auth, authorizeRoles("csr", "admin"), createLeadValidator, validateRequest, createLead);
router.get("/get-single-leads/:id", auth, getSingleLead);
router.patch("/update-leads/:id", auth, authorizeRoles("csr", "admin"), updateLeadValidator, validateRequest, updateLead);
router.delete("/delete-leads/:id", auth, authorizeRoles("csr", "admin"), deleteLead);

// ================= Admin Routes =================
router.get("/get-all-leads", auth, authorizeRoles("admin"), getAllLeads);
// Logged-in CSR: get their own leads
router.get("/csr", auth, getLeadsByCSR);  // ✅ NEW

// ================= Excel & Bulk Upload =================
router.post("/upload-excel",
	auth, authorizeRoles("admin"),
	upload.single("file"),
	uploadLeads);
router.post("/parse-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	parseExcelFile);
router.post("/bulk-insert-excel",
	auth, authorizeRoles("admin"),
	upload.single("file"),
	bulkInsertLeads);
router.post("/validate-excel",
	auth, authorizeRoles("admin"),
	upload.single("file"),
	validateExcelData);

module.exports = router;
