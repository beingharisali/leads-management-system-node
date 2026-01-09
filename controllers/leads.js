const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Lead = require("../models/leads.js");
const Sale = require("../models/Sale.js");
const asyncWrapper = require("../middleware/async"); // Task 34
const { BadRequestError, NotFoundError } = require("../errors");

// ===============================
// Admin: Get all leads
// ===============================
const getAllLeads = asyncWrapper(async (req, res) => {
	const leads = await Lead.find({});
	res.status(200).json({
		success: true,
		message: "All leads fetched successfully",
		data: leads,
		count: leads.length,
	});
});

// ===============================
// Admin: Get leads by CSR
// ===============================
const getLeadsByCSR = asyncWrapper(async (req, res) => {
	const leads = await Lead.find({ assignedTo: req.params.csrId });
	res.status(200).json({
		success: true,
		message: "Leads for the specified CSR fetched successfully",
		data: leads,
		count: leads.length,
	});
});

// ===============================
// TASK-06: Create a new lead
// ===============================
const createLead = asyncWrapper(async (req, res) => {
	let { assignedTo, ...rest } = req.body;

	if (req.user.role === "admin") {
		if (!assignedTo) throw new BadRequestError("Admin must specify assignedTo (CSR ID)");
		assignedTo = new mongoose.Types.ObjectId(assignedTo);
	} else {
		assignedTo = new mongoose.Types.ObjectId(req.user.userId);
	}

	const lead = await Lead.create({ ...rest, assignedTo });
	res.status(201).json({
		success: true,
		message: "Lead created successfully",
		data: lead,
	});
});

// ===============================
// Get leads assigned to logged-in CSR
// ===============================
const getLeads = asyncWrapper(async (req, res) => {
	const leads = await Lead.find({ assignedTo: req.user.userId });
	res.status(200).json({
		success: true,
		message: "Leads fetched successfully",
		data: leads,
		count: leads.length,
	});
});

// ===============================
// Get leads filtered by date
// ===============================
const getLeadsByDate = asyncWrapper(async (req, res) => {
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
			throw new BadRequestError("Invalid filter");
	}

	const leads = await Lead.find({
		assignedTo: req.user.userId,
		createdAt: { $gte: startDate },
	});
	res.status(200).json({
		success: true,
		message: "Leads fetched successfully by date filter",
		data: leads,
		count: leads.length,
	});
});

// ===============================
// Get single lead
// ===============================
const getSingleLead = asyncWrapper(async (req, res) => {
	const lead = await Lead.findById(req.params.id);
	if (!lead) throw new NotFoundError("Lead not found");

	if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) {
		throw new BadRequestError("Access denied");
	}

	res.status(200).json({
		success: true,
		message: "Lead fetched successfully",
		data: lead,
	});
});

// ===============================
// Update lead
// ===============================
const updateLead = asyncWrapper(async (req, res) => {
	const lead = await Lead.findById(req.params.id);
	if (!lead) throw new NotFoundError("Lead not found");

	if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) {
		throw new BadRequestError("Unauthorized");
	}

	const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
		new: true,
		runValidators: true,
	});
	res.status(200).json({
		success: true,
		message: "Lead updated successfully",
		data: updatedLead,
	});
});

// ===============================
// Delete lead
// ===============================
const deleteLead = asyncWrapper(async (req, res) => {
	const lead = await Lead.findById(req.params.id);
	if (!lead) throw new NotFoundError("Lead not found");

	if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) {
		throw new BadRequestError("Unauthorized");
	}

	await lead.deleteOne();
	res.status(200).json({
		success: true,
		message: "Lead deleted successfully",
	});
});

// ===============================
// Convert lead to sale (TASK-19)
// ===============================
const convertLeadToSale = asyncWrapper(async (req, res) => {
	const { amount } = req.body;
	if (!amount) throw new BadRequestError("Amount required");

	const lead = await Lead.findById(req.params.id);
	if (!lead) throw new NotFoundError("Lead not found");

	const sale = await Sale.create({
		lead: lead._id,
		csr: lead.assignedTo,
		amount,
		status: "completed",
	});

	lead.status = "converted";
	await lead.save();

	res.status(201).json({
		success: true,
		message: "Lead converted to sale successfully",
		data: sale,
	});
});

// ===============================
// TASK-24: Upload leads via Excel
// ===============================
const uploadLeads = asyncWrapper(async (req, res) => {
	const workbook = xlsx.readFile(req.file.path);
	const sheet = workbook.Sheets[workbook.SheetNames[0]];
	const data = xlsx.utils.sheet_to_json(sheet);

	const leads = data.map((row) => ({
		name: row.name,
		phone: row.phone,
		course: row.course,
		source: row.source,
		status: "new",
		assignedTo: new mongoose.Types.ObjectId(req.body.assignedTo),
	}));

	const inserted = await Lead.insertMany(leads);
	res.status(201).json({
		success: true,
		message: "Leads uploaded successfully",
		count: inserted.length,
	});
});

// ===============================
// TASK-27: Validate Excel Data
// ===============================
const validateExcelData = asyncWrapper(async (req, res) => {
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
		message: "Excel data validated successfully",
		validCount: validRows.length,
		invalidCount: invalidRows.length,
		validRows,
		invalidRows,
	});
});

// ===============================
// TASK-28: Bulk Insert with Error Handling
// ===============================
const bulkInsertLeads = asyncWrapper(async (req, res) => {
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
		message: "Bulk insert completed",
		insertedCount: inserted.length,
		skippedCount: invalidRows.length,
		skippedRows: invalidRows,
	});
});

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
	bulkInsertLeads,    // Task 26 + 28
	validateExcelData,  // Task 27
};
