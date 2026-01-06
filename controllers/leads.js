const mongoose = require("mongoose");
const Lead = require("../models/leads.js");
const Sale = require("../models/Sale.js");
const xlsx = require("xlsx"); // Task 24 ke liye Excel parse
const XLSX = require("xlsx");
const path = require("path");

// ===============================
// ✅ TASK-06: Create a new lead
// ===============================
const createLead = async (req, res) => {
	try {
		let { assignedTo, ...rest } = req.body;

		if (req.user.role === "admin") {
			if (!assignedTo) {
				return res.status(400).json({
					success: false,
					msg: "Admin must specify assignedTo (CSR ID)",
				});
			}
			assignedTo = new mongoose.Types.ObjectId(assignedTo);
		} else {
			assignedTo = new mongoose.Types.ObjectId(req.user.userId);
		}

		const lead = await Lead.create({ ...rest, assignedTo });

		res.status(201).json({
			success: true,
			msg: "Lead created successfully",
			data: lead,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in creating lead",
			error: error.message,
		});
	}
};

// ===============================
// Get leads assigned to logged-in CSR
// ===============================
const getLeads = async (req, res) => {
	try {
		const leads = await Lead.find({ assignedTo: req.user.userId });
		res.status(200).json({ success: true, msg: "Leads fetched successfully", data: leads });
	} catch (error) {
		res.status(400).json({ success: false, msg: "Error occurred in fetching leads", error: error.message });
	}
};

// ===============================
// Get leads filtered by date
// ===============================
const getLeadsByDate = async (req, res) => {
	const { filter } = req.query;
	const now = new Date();
	let startDate;

	switch (filter) {
		case "day": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
		case "week": startDate = new Date(now.setDate(now.getDate() - now.getDay())); break;
		case "month": startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
		default:
			return res.status(400).json({ success: false, msg: "Invalid filter. Use day, week, or month." });
	}

	try {
		const leads = await Lead.find({ assignedTo: req.user.userId, createdAt: { $gte: startDate } });
		res.status(200).json({ success: true, msg: `Leads fetched successfully for ${filter}`, data: leads });
	} catch (error) {
		res.status(400).json({ success: false, msg: "Error occurred in fetching leads by date", error: error.message });
	}
};

// ===============================
// Get single lead
// ===============================
const getSingleLead = async (req, res) => {
	try {
		const lead = await Lead.findById(req.params.id);
		if (!lead) return res.status(404).json({ success: false, msg: "Lead not found" });
		if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) {
			return res.status(403).json({ success: false, msg: "Access denied" });
		}
		res.status(200).json({ success: true, msg: "Lead fetched successfully", data: lead });
	} catch (error) {
		res.status(400).json({ success: false, msg: "Error occurred in fetching lead", error: error.message });
	}
};

// ===============================
// Update lead
// ===============================
const updateLead = async (req, res) => {
	try {
		const lead = await Lead.findById(req.params.id);
		if (!lead) return res.status(404).json({ success: false, msg: "Lead not found" });
		if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) {
			return res.status(403).json({ success: false, msg: "You cannot update this lead" });
		}
		const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
		res.status(200).json({ success: true, msg: "Lead updated successfully", data: updatedLead });
	} catch (error) {
		res.status(400).json({ success: false, msg: "Error occurred in updating lead", error: error.message });
	}
};

// ===============================
// Delete lead
// ===============================
const deleteLead = async (req, res) => {
	try {
		const lead = await Lead.findById(req.params.id);
		if (!lead) return res.status(404).json({ success: false, msg: "Lead not found" });
		if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) {
			return res.status(403).json({ success: false, msg: "You cannot delete this lead" });
		}
		await lead.deleteOne();
		res.status(200).json({ success: true, msg: "Lead deleted successfully" });
	} catch (error) {
		res.status(400).json({ success: false, msg: "Error occurred in deleting lead", error: error.message });
	}
};

// ===============================
// Convert lead to sale (TASK-19)
// ===============================
const convertLeadToSale = async (req, res) => {
	const { amount } = req.body;
	if (!amount) return res.status(400).json({ success: false, msg: "Please provide sale amount" });

	try {
		const lead = await Lead.findById(req.params.id);
		if (!lead) return res.status(404).json({ success: false, msg: "Lead not found" });
		if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) {
			return res.status(403).json({ success: false, msg: "You cannot convert leads not assigned to you" });
		}

		const sale = await Sale.create({ lead: lead._id, csr: lead.assignedTo, amount, status: "completed" });
		lead.status = "converted";
		await lead.save();

		res.status(201).json({ success: true, msg: "Lead converted to sale successfully", data: sale });
	} catch (error) {
		res.status(400).json({ success: false, msg: "Error converting lead to sale", error: error.message });
	}
};

// ===============================
// Admin: Get all leads
// ===============================
const getAllLeads = async (req, res) => {
	if (req.user.role !== "admin") return res.status(403).json({ success: false, msg: "Admins only" });
	const leads = await Lead.find({});
	res.status(200).json({ success: true, msg: "All leads fetched successfully", data: leads });
};

// ===============================
// Admin: Get leads by CSR
// ===============================
const getLeadsByCSR = async (req, res) => {
	const leads = await Lead.find({ assignedTo: req.params.csrId });
	res.status(200).json({ success: true, msg: "Leads fetched successfully", data: leads });
};

// ===============================
// ✅ TASK-24: Upload leads via Excel (Admin only)
// ===============================
const uploadLeads = async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ success: false, msg: "No file uploaded" });

		const workbook = xlsx.readFile(req.file.path);
		const sheet = workbook.Sheets[workbook.SheetNames[0]];
		const data = xlsx.utils.sheet_to_json(sheet);

		const leadsToInsert = data.map((row) => ({
			name: row.name,
			phone: row.phone,
			course: row.course,
			source: row.source,
			status: "new",
			assignedTo: req.body.assignedTo ? new mongoose.Types.ObjectId(req.body.assignedTo) : null,
		}));

		const insertedLeads = await Lead.insertMany(leadsToInsert);
		res.status(201).json({ success: true, msg: `${insertedLeads.length} leads uploaded successfully`, data: insertedLeads });
	} catch (error) {
		res.status(400).json({ success: false, msg: "Error uploading leads from Excel", error: error.message });
	}
};

// ===============================
// ✅ TASK-26: Bulk insert leads from parsed Excel (Admin only)
// ===============================
const bulkInsertLeads = async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ success: false, msg: "No file uploaded" });

		const workbook = xlsx.readFile(req.file.path);
		const sheet = workbook.Sheets[workbook.SheetNames[0]];
		const data = xlsx.utils.sheet_to_json(sheet);

		if (!data.length) return res.status(400).json({ success: false, msg: "Excel file is empty" });

		const leadsToInsert = data.map((row) => ({
			name: row.name || "Unknown",
			course: row.course || "",
			source: row.source || "",
			phone: row.phone || "",
			status: row.status || "new",
			assignedTo: req.body.assignedTo
				? new mongoose.Types.ObjectId(req.body.assignedTo)
				: req.user.role === "csr"
					? new mongoose.Types.ObjectId(req.user.userId)
					: null,
		}));

		const insertedLeads = await Lead.insertMany(leadsToInsert);
		res.status(201).json({ success: true, msg: `${insertedLeads.length} leads inserted successfully`, data: insertedLeads });
	} catch (error) {
		res.status(500).json({ success: false, msg: "Error in bulk inserting leads", error: error.message });
	}
};

// ===============================
// ✅ TASK-27: Validate Excel Data before insert
// ===============================
const validateExcelData = async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, msg: "No file uploaded" });
		}

		// Uploaded file path
		const filePath = path.join(__dirname, "../uploads", req.file.filename);

		// Excel file read
		const workbook = XLSX.readFile(filePath);
		const sheet = workbook.Sheets[workbook.SheetNames[0]];

		// Convert to JSON
		const data = XLSX.utils.sheet_to_json(sheet);

		if (!data.length) {
			return res.status(400).json({ success: false, msg: "Excel file is empty" });
		}

		const validRows = [];
		const invalidRows = [];

		data.forEach((row, index) => {
			const { name, phone, course, source } = row;

			// Basic validation: name, phone, course required
			if (name && phone && course) {
				validRows.push({ ...row, rowNumber: index + 2 }); // Excel headers row=1
			} else {
				invalidRows.push({ ...row, rowNumber: index + 2 });
			}
		});

		res.status(200).json({
			success: true,
			msg: "Excel validation completed",
			totalRows: data.length,
			validRows,
			invalidRows,
			validCount: validRows.length,
			invalidCount: invalidRows.length,
		});
	} catch (error) {
		res.status(500).json({ success: false, msg: "Error validating Excel file", error: error.message });
	}
};

module.exports = {
	createLead,
	getLeads,
	getLeadsByDate,
	getSingleLead,
	updateLead,
	deleteLead,
	convertLeadToSale,
	getAllLeads,
	getLeadsByCSR,
	uploadLeads,       // Task 24
	bulkInsertLeads,   // Task 26 added
	validateExcelData, // Task 27
};
