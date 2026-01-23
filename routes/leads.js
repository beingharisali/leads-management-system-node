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
	deleteAllLeads, // Admin function
	getAllLeads,
	convertLeadToSale,
	getLeadsByCSR,
	uploadLeads,
	bulkInsertLeads,
} = require("../controllers/leads");

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

/* =============================================================================
  IMPORTANT: Route Ordering
  Specific routes (like /delete-all) must be ABOVE dynamic routes (like /:id)
  =============================================================================
*/

// 1. --- Admin Only (High Priority) ---

// Isay sabse upar rakhein taake Express isay ID na samjhe
router.delete("/delete-all", auth, authorizeRoles("admin"), deleteAllLeads);

router.get("/get-all-leads", auth, authorizeRoles("admin"), getAllLeads);
router.get("/csr", auth, authorizeRoles("admin"), getLeadsByCSR);

// 2. --- Shared Routes (Fixed Paths) ---

router.get("/csr/:csrId", auth, getLeadsByCSR);
router.get("/get-leads", auth, getLeads);
router.get("/get-leads-by-date", auth, getLeadsByDateValidator, validateRequest, getLeadsByDate);

// 3. --- Lead Operations (Creation & Bulk) ---

router.post("/create-leads", auth, authorizeRoles("csr", "admin"), createLeadValidator, validateRequest, createLead);

// Bulk Operations
router.post("/bulk-insert-excel", auth, authorizeRoles("admin", "csr"), upload.single("file"), bulkInsertLeads);
router.post("/upload-excel-array", auth, authorizeRoles("csr", "admin"), uploadLeads);

// Excel Utils
router.post("/parse-excel", auth, authorizeRoles("admin"), upload.single("file"), parseExcelFile);
router.post("/validate-excel", auth, authorizeRoles("admin"), upload.single("file"), validateExcelData);

// 4. --- Dynamic Routes (Low Priority - ID Based) ---
// Note: Yeh routes hamesha aakhir mein aane chahiye

router.get("/get-single-leads/:id", auth, getSingleLead);
router.patch("/update-leads/:id", auth, authorizeRoles("csr", "admin"), updateLeadValidator, validateRequest, updateLead);
router.delete("/delete-leads/:id", auth, authorizeRoles("csr", "admin"), deleteLead);
router.post("/convert-to-sale/:id", auth, authorizeRoles("csr", "admin"), convertLeadToSale);

module.exports = router;