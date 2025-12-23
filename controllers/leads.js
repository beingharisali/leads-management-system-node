const model = require("../models/leads.js");

const createLead = async (req, res) => {
	try {
		const leads = await model.create(req.body);
		res.status(201).json({
			success: true,
			msg: "lead created successfully",
			leads: leads,
		});
	} catch (error) {
		res.status(401).json({
			success: false,
			msg: "Error occured in creating lead",
			error: error,
		});
	}
};
const getLeads = async (req, res) => {
	try {
		const leads = await model.find({});
		res.status(200).json({
			success: true,
			msg: "Leads fetched successfully",
			leads: leads,
		});
	} catch (error) {
		res.status(401).json({
			success: false,
			msg: "error occured in fetching leads",
			error: error,
		});
	}
};
const getSingleLead = async (req, res) => {
	const id = params.id;
	try {
		const leads = await model.findById({ id });
		res.status(200).json({
			success: true,
			msg: "lead fetched successfully",
			leads: leads,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "error occured in fetching lead",
			error: error,
		});
	}
};

const deletLead = async (req, res) => {
	const id = params.id;
	try {
		const leads = await model.findByIdAndDelete({ id });
		res.status(201).json({
			success: true,
			msg: "lead deleted successfully",
			leads: leads,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			msg: "error occured in deleting lead",
			error: error,
		});
	}
};
const updateLead = async (req, res) => {
	const id = params.id;
	try {
		const leads = await model.findByIdAndUpdate({ id });
		res.status(201).json({
			success: true,
			msg: "lead updated successfully",
			leads: leads,
		});
	} catch (error) {
		res.status(400).json({
			success: true,
			msg: "Error occured in updating lead",
			error: error,
		});
	}
};

module.exports = { createLead, getLeads, updateLead, deletLead, getSingleLead };
