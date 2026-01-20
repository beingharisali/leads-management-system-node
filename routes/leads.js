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
// Logged-in CSR: get their own leads
router.get("/csr", auth, getLeadsByCSR);

// ================= Excel & Bulk Upload =================

// Admin Excel upload
router.post("/upload-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	uploadLeads
);

// CSR Excel upload (array)
router.post("/upload-excel-array",
	auth,
	authorizeRoles("csr", "admin"),
	async (req, res) => {
		try {
			const { leads, assignedTo } = req.body; // leads array + csrId
			if (!leads || !assignedTo) {
				return res.status(400).json({ success: false, message: "Leads or CSR ID missing" });
			}

			const savedLeads = await Promise.all(
				leads.map(async (lead) => {
					return await createLead({
						name: lead.name,
						phone: lead.phone,
						course: lead.course,
						assignedTo: assignedTo,
						status: "new",
					});
				})
			);

			return res.status(201).json({ success: true, message: "Leads uploaded successfully", data: savedLeads });
		} catch (err) {
			console.error(err);
			res.status(500).json({ success: false, message: "Excel upload failed" });
		}
	}
);

router.post("/parse-excel",
	auth,
	authorizeRoles("admin"),
	upload.single("file"),
	parseExcelFile
);
router.post("/bulk-insert-excel",
	auth, authorizeRoles("admin"),
	upload.single("file"),
	bulkInsertLeads
);
router.post("/validate-excel",
	auth, authorizeRoles("admin"),
	upload.single("file"),
	validateExcelData
);

module.exports = router;
