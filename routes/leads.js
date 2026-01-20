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

// Convert Lead to Sale
router.post("/convert-to-sale/:id", auth, authorizeRoles("csr", "admin"), convertLeadToSale);

// ================= Admin Routes =================
router.get("/get-all-leads", auth, authorizeRoles("admin"), getAllLeads);
router.get("/csr", auth, getLeadsByCSR);

// ================= Excel & Bulk Upload =================

// Admin Excel upload
router.post("/upload-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	uploadLeads
);

// CSR Excel upload (array) - now inserts into DB
router.post("/upload-excel-array",
	auth,
	authorizeRoles("csr", "admin"),
	async (req, res, next) => {
		const LeadModel = require("../models/leads"); // direct model
		try {
			const { leads, csrId } = req.body;
			const createdBy = req.user.userId;

			if (!Array.isArray(leads) || !leads.length) {
				return res.status(400).json({ success: false, message: "Leads array is empty or invalid" });
			}

			const validLeads = leads.filter(
				(l) => l.name?.trim() && l.phone?.trim() && l.course?.trim()
			);

			if (!validLeads.length) {
				return res.status(400).json({ success: false, message: "No valid leads found" });
			}

			// CSR ID check
			const assignTo = req.user.role === "csr" ? req.user.userId : csrId;

			const leadsToInsert = validLeads.map((lead) => ({
				name: lead.name.trim(),
				phone: lead.phone.trim(),
				course: lead.course.trim(),
				assignedTo: assignTo,
				createdBy,
				status: "new",
				source: lead.source || "Excel Upload",
			}));

			// INSERT INTO DATABASE
			const insertedLeads = await LeadModel.insertMany(leadsToInsert);

			return res.status(201).json({
				success: true,
				message: `${insertedLeads.length} leads uploaded successfully`,
				data: insertedLeads,
				count: insertedLeads.length,
			});

		} catch (err) {
			console.error("CSR Excel Upload Error:", err);
			next(err);
		}
	}
);

// Other Excel endpoints
router.post("/parse-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	parseExcelFile
);

router.post("/bulk-insert-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	bulkInsertLeads
);

router.post("/validate-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	validateExcelData
);

module.exports = router;
