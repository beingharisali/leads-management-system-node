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
	convertLeadToSale,
	getLeadsByCSR,
	uploadLeads,
	bulkInsertLeads,
} = require("../controllers/leads");

// Excel Controllers
const {
	parseExcelFile,
	validateExcelData,
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

// ================= Shared Routes (Admin & CSR) ================

// Get leads assigned to CSR or specific CSR for Admin
router.get("/csr/:csrId", auth, getLeadsByCSR);
router.get("/get-leads", auth, getLeads);

// Lead Management
router.get("/get-leads-by-date", auth, getLeadsByDateValidator, validateRequest, getLeadsByDate);
router.post("/create-leads", auth, authorizeRoles("csr", "admin"), createLeadValidator, validateRequest, createLead);
router.get("/get-single-leads/:id", auth, getSingleLead);
router.patch("/update-leads/:id", auth, authorizeRoles("csr", "admin"), updateLeadValidator, validateRequest, updateLead);
router.delete("/delete-leads/:id", auth, authorizeRoles("csr", "admin"), deleteLead);

// Sales Conversion
router.post("/convert-to-sale/:id", auth, authorizeRoles("csr", "admin"), convertLeadToSale);

// ================= Admin Only Routes =================
router.get("/get-all-leads", auth, authorizeRoles("admin"), getAllLeads);
router.get("/csr", auth, authorizeRoles("admin"), getLeadsByCSR);

// ================= Excel & Bulk Upload (Updated) =================

/**
 * 1. Bulk Insert from File (Admin Dashboard)
 * FIXED: Added "csr" to authorizeRoles so that if an admin is acting as a CSR or 
 * vice versa, the request doesn't fail with 500/403.
 */
router.post("/bulk-insert-excel",
	auth,
	authorizeRoles("admin", "csr"),
	upload.single("file"),
	bulkInsertLeads
);

/**
 * 2. Upload JSON Array (CSR Dashboard Preview)
 * FIXED: Uses the optimized uploadLeads controller function
 */
router.post("/upload-excel-array",
	auth,
	authorizeRoles("csr", "admin"),
	uploadLeads
);

/**
 * 3. General Excel Utils
 */
router.post("/parse-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	parseExcelFile
);

router.post("/validate-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	validateExcelData
);

module.exports = router;