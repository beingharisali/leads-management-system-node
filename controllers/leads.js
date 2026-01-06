const mongoose = require("mongoose");
const Lead = require("../models/leads.js");
const Sale = require("../models/Sale.js");
const xlsx = require("xlsx");
// ===============================
// Admin: Get all leads
// ===============================
const getAllLeads = async (req, res) => {
	try {
		const leads = await Lead.find({});
		res.status(200).json({ success: true, data: leads });
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
};

// ===============================
// Admin: Get leads by CSR
// ===============================
const getLeadsByCSR = async (req, res) => {
	try {
		const leads = await Lead.find({ assignedTo: req.params.csrId });
		res.status(200).json({ success: true, data: leads });
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
};

// ===============================
// TASK-06: Create a new lead
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
		res.status(200).json({ success: true, data: leads });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
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
		case "day":
			startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			break;
		case "week":
			startDate = new Date(now.setDate(now.getDate() - now.getDay()));
			break;
		case "month":
			startDate = new Date(now.getFullYear(), now.getMonth(), 1);
			break;
		default:
			return res.status(400).json({ success: false, msg: "Invalid filter" });
	}

	try {
		const leads = await Lead.find({
			assignedTo: req.user.userId,
			createdAt: { $gte: startDate },
		});
		res.status(200).json({ success: true, data: leads });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
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

		res.status(200).json({ success: true, data: lead });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
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
			return res.status(403).json({ success: false, msg: "Unauthorized" });
		}

		const updatedLead = await Lead.findByIdAndUpdate(
			req.params.id,
			req.body,
			{ new: true, runValidators: true }
		);

		res.status(200).json({ success: true, data: updatedLead });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
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
			return res.status(403).json({ success: false, msg: "Unauthorized" });
		}

		await lead.deleteOne();
		res.status(200).json({ success: true, msg: "Lead deleted" });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
	}
};

// ===============================
// Convert lead to sale (TASK-19)
// ===============================
const convertLeadToSale = async (req, res) => {
	const { amount } = req.body;
	if (!amount) return res.status(400).json({ success: false, msg: "Amount required" });

	try {
		const lead = await Lead.findById(req.params.id);
		if (!lead) return res.status(404).json({ success: false, msg: "Lead not found" });

		const sale = await Sale.create({
			lead: lead._id,
			csr: lead.assignedTo,
			amount,
			status: "completed",
		});

		lead.status = "converted";
		await lead.save();

		res.status(201).json({ success: true, data: sale });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
	}
};

// ===============================
// TASK-24: Upload leads via Excel
// ===============================
const uploadLeads = async (req, res) => {
	try {
		const workbook = xlsx.readFile(req.file.path);
		const sheet = workbook.Sheets[workbook.SheetNames[0]];
		const data = xlsx.utils.sheet_to_json(sheet);

		const leads = data.map(row => ({
			name: row.name,
			phone: row.phone,
			course: row.course,
			source: row.source,
			status: "new",
			assignedTo: new mongoose.Types.ObjectId(req.body.assignedTo),
		}));

		const inserted = await Lead.insertMany(leads);
		res.status(201).json({ success: true, count: inserted.length });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
	}
};

// ===============================
// TASK-27: Validate Excel Data
// ===============================
const validateExcelData = async (req, res) => {
	const workbook = xlsx.readFile(req.file.path);
	const sheet = workbook.Sheets[workbook.SheetNames[0]];
	const data = xlsx.utils.sheet_to_json(sheet);

	const validRows = [];
	const invalidRows = [];

	data.forEach((row, index) => {
		if (row.name && row.phone && row.course) {
			validRows.push({ ...row, rowNumber: index + 2 });
		} else {
			invalidRows.push({ ...row, rowNumber: index + 2 });
		}
	});

	res.status(200).json({
		success: true,
		validCount: validRows.length,
		invalidCount: invalidRows.length,
		validRows,
		invalidRows,
	});
};

// ===============================
// TASK-28: Bulk Insert with Error Handling
// ===============================
const bulkInsertLeads = async (req, res) => {
	const workbook = xlsx.readFile(req.file.path);
	const sheet = workbook.Sheets[workbook.SheetNames[0]];
	const data = xlsx.utils.sheet_to_json(sheet);

	const validRows = [];
	const invalidRows = [];

	data.forEach((row, index) => {
		const missing = [];
		if (!row.name) missing.push("name");
		if (!row.phone) missing.push("phone");
		if (!row.course) missing.push("course");

		if (missing.length === 0) {
			validRows.push({
				name: row.name,
				phone: row.phone,
				course: row.course,
				source: row.source || "",
				status: "new",
				assignedTo: new mongoose.Types.ObjectId(req.body.assignedTo),
			});
		} else {
			invalidRows.push({
				rowNumber: index + 2,
				missingFields: missing,
				rowData: row,
			});
		}
	});

	const inserted = validRows.length ? await Lead.insertMany(validRows) : [];

	res.status(201).json({
		success: true,
		insertedCount: inserted.length,
		skippedCount: invalidRows.length,
		skippedRows: invalidRows,
	});
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
	uploadLeads,        // Task 24
	bulkInsertLeads,    // Task 26 + 28 (ONLY ONE)
	validateExcelData,  // Task 27
};
