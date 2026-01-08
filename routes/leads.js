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
	bulkInsertLeads,   // Task 26 + Task 28 (with invalid rows handling)
} = require("../controllers/leads");

// Excel Controllers
const {
	parseExcelFile,    // Task 25
	validateExcelData, // Task 27
} = require("../controllers/parseExcel");

// Middleware
const { auth, authorizeRoles } = require("../middleware/authentication"); // ✅ destructured import
const upload = require("../middleware/upload");

// ================= CSR Routes =================
router.get("/get-leads", auth, getLeads);
router.get("/get-leads-by-date", auth, getLeadsByDate);
router.post("/create-leads", auth, authorizeRoles("csr", "admin"), createLead); // ✅ csr + admin can create
router.get("/get-single-leads/:id", auth, getSingleLead);
router.patch("/update-leads/:id", auth, authorizeRoles("csr", "admin"), updateLead);
router.delete("/delete-leads/:id", auth, authorizeRoles("csr", "admin"), deleteLead);

// ================= Admin Routes =================
router.get(
	"/get-all-leads",
	auth,
	authorizeRoles("admin"), // ✅ admin-only
	getAllLeads
);

router.get(
	"/get-leads-by-csr/:csrId",
	auth,
	authorizeRoles("admin"),
	getLeadsByCSR
);

// ================= Task 24: Upload Excel =================
router.post(
	"/upload-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	uploadLeads
);

// ================= Task 25: Parse Excel =================
router.post(
	"/parse-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	parseExcelFile
);

// ================= Task 26 + 28: Bulk Insert (with error handling) =================
router.post(
	"/bulk-insert-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	bulkInsertLeads
);

// ================= Task 27: Validate Excel =================
router.post(
	"/validate-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	validateExcelData
);

module.exports = router;
