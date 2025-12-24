const Lead = require("../models/leads.js");

// Create a new lead
const createLead = async (req, res) => {
	try {
		const lead = await Lead.create(req.body);
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

// Get leads assigned to logged-in CSR
const getLeads = async (req, res) => {
	try {
		const csrId = req.user.userId;
		const leads = await Lead.find({ assignedTo: csrId });
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

// Get leads filtered by date (day/week/month)
const getLeadsByDate = async (req, res) => {
	const csrId = req.user.userId;
	const { filter } = req.query;

	let startDate;
	const now = new Date();

	switch (filter) {
		case "day":
			startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			break;
		case "week":
			const firstDayOfWeek = now.getDate() - now.getDay(); // Sunday = 0
			startDate = new Date(now.getFullYear(), now.getMonth(), firstDayOfWeek);
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
			assignedTo: csrId,
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

// Get single lead by ID
const getSingleLead = async (req, res) => {
	const id = req.params.id;
	try {
		const lead = await Lead.findById(id);
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

// Delete lead by ID
const deleteLead = async (req, res) => {
	const id = req.params.id;
	try {
		const lead = await Lead.findByIdAndDelete(id);
		res.status(200).json({
			success: true,
			msg: "Lead deleted successfully",
			data: lead,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in deleting lead",
			error: error.message,
		});
	}
};


const updateLead = async (req, res) => {
	const id = req.params.id;
	try {
		const lead = await Lead.findByIdAndUpdate(id, req.body, {
			new: true,
			runValidators: true,
		});
		res.status(200).json({
			success: true,
			msg: "Lead updated successfully",
			data: lead,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in updating lead",
			error: error.message,
		});
	}
};


const updateLeadStatus = async (req, res) => {
	const id = req.params.id;
	const { status } = req.body;

	try {
		const lead = await Lead.findByIdAndUpdate(
			id,
			{ status },
			{ new: true, runValidators: true }
		);
		res.status(200).json({
			success: true,
			msg: "Lead status updated successfully",
			data: lead,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in updating lead status",
			error: error.message,
		});
	}
};


const getAllLeads = async (req, res) => {
	try {
		if (req.user.role !== "admin") {
			return res.status(403).json({
				success: false,
				msg: "Access denied. Admins only.",
			});
		}

		const leads = await Lead.find({});
		res.status(200).json({
			success: true,
			msg: "All leads fetched successfully",
			data: leads,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in fetching all leads",
			error: error.message,
		});
	}
};

const getLeadsByCSR = async (req, res) => {
	const { csrId } = req.params;

	try {
		const leads = await Lead.find({ assignedTo: csrId });
		res.status(200).json({
			success: true,
			msg: `Leads fetched successfully for CSR: ${csrId}`,
			data: leads,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "Error occurred in fetching leads by CSR",
			error: error.message,
		});
	}
};

module.exports = {
	createLead,
	getLeads,
	getLeadsByDate,
	getSingleLead,
	updateLead,
	deleteLead,
	updateLeadStatus,
	getAllLeads,
	getLeadsByCSR,
};
