const mongoose = require("mongoose");
const Lead = require("../models/leads.js");
const Sale = require("../models/Sale.js");

// ===============================
// ✅ TASK-06: Create a new lead
// ===============================
const createLead = async (req, res) => {
	try {
		let { assignedTo, ...rest } = req.body;

		if (req.user.role === "admin") {
			// Admin must assign lead to CSR
			if (!assignedTo) {
				return res.status(400).json({
					success: false,
					msg: "Admin must specify assignedTo (CSR ID)",
				});
			}
			assignedTo = new mongoose.Types.ObjectId(assignedTo);
		} else {
			// CSR khud ke liye lead create kare
			assignedTo = new mongoose.Types.ObjectId(req.user.userId);
		}

		const lead = await Lead.create({
			...rest,
			assignedTo,
		});

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
		const leads = await Lead.find({
			assignedTo: req.user.userId,
		});

		res.status(200).json({
			success: true,
			msg: "Leads fetched successfully",
			data: leads,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in fetching leads",
			error: error.message,
		});
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
			return res.status(400).json({
				success: false,
				msg: "Invalid filter. Use day, week, or month.",
			});
	}

	try {
		const leads = await Lead.find({
			assignedTo: req.user.userId,
			createdAt: { $gte: startDate },
		});

		res.status(200).json({
			success: true,
			msg: `Leads fetched successfully for ${filter}`,
			data: leads,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in fetching leads by date",
			error: error.message,
		});
	}
};

// ===============================
// Get single lead
// ===============================
const getSingleLead = async (req, res) => {
	try {
		const lead = await Lead.findById(req.params.id);

		if (!lead) {
			return res.status(404).json({
				success: false,
				msg: "Lead not found",
			});
		}

		// CSR sirf apni lead dekh sakta
		if (
			req.user.role === "csr" &&
			lead.assignedTo.toString() !== req.user.userId
		) {
			return res.status(403).json({
				success: false,
				msg: "Access denied",
			});
		}

		res.status(200).json({
			success: true,
			msg: "Lead fetched successfully",
			data: lead,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in fetching lead",
			error: error.message,
		});
	}
};

// ===============================
// Update lead
// ===============================
const updateLead = async (req, res) => {
	try {
		const lead = await Lead.findById(req.params.id);

		if (!lead) {
			return res.status(404).json({
				success: false,
				msg: "Lead not found",
			});
		}

		if (
			req.user.role === "csr" &&
			lead.assignedTo.toString() !== req.user.userId
		) {
			return res.status(403).json({
				success: false,
				msg: "You cannot update this lead",
			});
		}

		const updatedLead = await Lead.findByIdAndUpdate(
			req.params.id,
			req.body,
			{ new: true, runValidators: true }
		);

		res.status(200).json({
			success: true,
			msg: "Lead updated successfully",
			data: updatedLead,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in updating lead",
			error: error.message,
		});
	}
};

// ===============================
// Delete lead
// ===============================
const deleteLead = async (req, res) => {
	try {
		const lead = await Lead.findById(req.params.id);

		if (!lead) {
			return res.status(404).json({
				success: false,
				msg: "Lead not found",
			});
		}

		if (
			req.user.role === "csr" &&
			lead.assignedTo.toString() !== req.user.userId
		) {
			return res.status(403).json({
				success: false,
				msg: "You cannot delete this lead",
			});
		}

		await lead.deleteOne();

		res.status(200).json({
			success: true,
			msg: "Lead deleted successfully",
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in deleting lead",
			error: error.message,
		});
	}
};

// ===============================
// Convert lead to sale (TASK-19)
// ===============================
const convertLeadToSale = async (req, res) => {
	const { amount } = req.body;

	if (!amount) {
		return res.status(400).json({
			success: false,
			msg: "Please provide sale amount",
		});
	}

	try {
		const lead = await Lead.findById(req.params.id);

		if (!lead) {
			return res.status(404).json({
				success: false,
				msg: "Lead not found",
			});
		}

		// CSR sirf apni assigned lead convert kare
		if (
			req.user.role === "csr" &&
			lead.assignedTo.toString() !== req.user.userId
		) {
			return res.status(403).json({
				success: false,
				msg: "You cannot convert leads not assigned to you",
			});
		}

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
			msg: "Lead converted to sale successfully",
			data: sale,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error converting lead to sale",
			error: error.message,
		});
	}
};

// ===============================
// Admin: Get all leads
// ===============================
const getAllLeads = async (req, res) => {
	if (req.user.role !== "admin") {
		return res.status(403).json({
			success: false,
			msg: "Admins only",
		});
	}

	const leads = await Lead.find({});
	res.status(200).json({
		success: true,
		msg: "All leads fetched successfully",
		data: leads,
	});
};

// ===============================
// Admin: Get leads by CSR
// ===============================
const getLeadsByCSR = async (req, res) => {
	const leads = await Lead.find({
		assignedTo: req.params.csrId,
	});

	res.status(200).json({
		success: true,
		msg: "Leads fetched successfully",
		data: leads,
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
};
