const express = require("express");
const router = express.Router();

// ================= Controllers =================
const {
	createLead,
	getLeads,
	getLeadsByDate,
	getSingleLead,
	updateLead,
	addRemark,
	getRemarkHistory,
	deleteLead,
	deleteAllLeads,
	getAllLeads,
	convertLeadToSale,
	getLeadsByCSR,
	bulkInsertLeads,
	getUrgentLeads,
	getAdminLeadSummary,
} = require("../controllers/leads");

const {
	parseExcelFile,
	validateExcelData,
} = require("../controllers/parseExcel");

// Middleware
const { auth, authorizeRoles, realAdminOnly } = require("../middleware/authentication");
const upload = require("../middleware/upload");

/* =============================================================================
   ROUTES CONFIGURATION
============================================================================= */

// --- 1. ADMIN EXCLUSIVE ---
router.get("/admin/all", auth, authorizeRoles("admin"), getAllLeads);
router.get("/admin/summary", auth, authorizeRoles("admin"), getAdminLeadSummary);
router.get("/admin/csr-report/:csrId", auth, authorizeRoles("admin"), getLeadsByCSR);
router.delete("/admin/delete-all", auth, authorizeRoles("admin"), realAdminOnly, deleteAllLeads);

// --- 2. BULK & EXCEL OPERATIONS ---
// Admin can upload, CSRs can only upload if you explicitly allow them
router.post("/bulk/upload-excel", auth, authorizeRoles("admin", "csr"), upload.single("file"), bulkInsertLeads);
router.post("/excel/parse", auth, authorizeRoles("admin"), upload.single("file"), parseExcelFile);
router.post("/excel/validate", auth, authorizeRoles("admin"), upload.single("file"), validateExcelData);

// --- 3. DATA RETRIEVAL (Shared/Protected) ---
router.get("/", auth, getLeads); // Main Dashboard fetch
router.get("/by-date", auth, getLeadsByDate);
router.get("/urgent", auth, getUrgentLeads); // must stay above "/:id"
router.get("/csr/:csrId", auth, getLeadsByCSR); // Admin checking specific CSR or CSR checking self

// --- 4. LEAD LIFECYCLE (CRUD) ---
router.post("/create", auth, authorizeRoles("admin", "csr"), createLead);

// ID Based Operations (Grouped for clarity)
router.route("/:id")
	.get(auth, getSingleLead)
	.patch(auth, updateLead) // Removed specific role check to allow both CSR & Admin
	.delete(auth, authorizeRoles("admin"), deleteLead); // Delete restricted to Admin

// Remark history (add-only)
router.get("/:id/remarks", auth, getRemarkHistory);
router.post("/:id/remarks", auth, addRemark);

// --- 5. SPECIAL OPERATIONS ---
router.post("/convert-to-sale/:id", auth, convertLeadToSale);

module.exports = router;