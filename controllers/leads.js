const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Lead = require("../models/leads.js");
const Sale = require("../models/Sale.js");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, NotFoundError } = require("../errors");

// ===============================
// Admin: Get all leads
// ===============================
const getAllLeads = asyncWrapper(async (req, res) => {
    const leads = await Lead.find({}).populate("assignedTo", "name email role");
    res.status(200).json({
        success: true,
        message: "All leads fetched successfully",
        data: leads,
        count: leads.length,
    });
});

// ===============================
// Get leads by CSR (Admin / CSR Dashboard)
// ===============================
const getLeadsByCSR = asyncWrapper(async (req, res) => {
    let csrId;
    if (req.user.role === "csr") {
        csrId = req.user.userId;
    } else {
        csrId = req.params.csrId;
        if (!mongoose.Types.ObjectId.isValid(csrId)) throw new BadRequestError("Invalid CSR ID");
    }
    const leads = await Lead.find({ assignedTo: csrId }).populate("assignedTo", "name email role");
    res.status(200).json({
        success: true,
        message: `Leads fetched successfully`,
        data: leads,
        count: leads.length,
    });
});

// ===============================
// Create a new lead
// ===============================
const createLead = asyncWrapper(async (req, res) => {
    const { name, phone, course, source } = req.body;
    if (!name || !phone || !course) throw new BadRequestError("Please provide name, phone, and course");

    let assignedTo = req.user.role === "admin" ? req.body.assignedTo : req.user.userId;
    if (req.user.role === "admin" && (!assignedTo || !mongoose.Types.ObjectId.isValid(assignedTo))) {
        throw new BadRequestError("Admin must provide valid CSR ID in assignedTo");
    }

    const lead = await Lead.create({ name, phone, course, source, assignedTo });
    res.status(201).json({ success: true, message: "Lead created successfully", data: lead });
});

// ===============================
// Get leads assigned to logged-in CSR
// ===============================
const getLeads = asyncWrapper(async (req, res) => {
    const leads = await Lead.find({ assignedTo: req.user.userId });
    res.status(200).json({ success: true, message: "Leads fetched successfully", data: leads, count: leads.length });
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
            const day = now.getDay() === 0 ? 7 : now.getDay();
            const firstDayOfWeek = new Date(now); firstDayOfWeek.setDate(now.getDate() - day + 1);
            startDate = new Date(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth(), firstDayOfWeek.getDate());
            break;
        case "month":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        default:
            throw new BadRequestError("Invalid filter");
    }
    const leads = await Lead.find({ assignedTo: req.user.userId, createdAt: { $gte: startDate } });
    res.status(200).json({ success: true, message: "Leads fetched successfully by date filter", data: leads, count: leads.length });
});

// ===============================
// Get single lead
// ===============================
const getSingleLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");
    if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) throw new BadRequestError("Access denied");
    res.status(200).json({ success: true, message: "Lead fetched successfully", data: lead });
});

// ===============================
// Update lead
// ===============================
const updateLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");
    if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) throw new BadRequestError("Unauthorized");
    Object.assign(lead, req.body);
    await lead.save();
    res.status(200).json({ success: true, message: "Lead updated successfully", data: lead });
});

// ===============================
// Delete lead
// ===============================
const deleteLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");
    if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) throw new BadRequestError("Unauthorized");
    await lead.deleteOne();
    res.status(200).json({ success: true, message: "Lead deleted successfully" });
});

// ===============================
// Convert lead to sale
// ===============================
const convertLeadToSale = asyncWrapper(async (req, res) => {
    const { amount } = req.body;
    if (!amount) throw new BadRequestError("Amount required");
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");
    if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) throw new BadRequestError("Unauthorized");
    const sale = await Sale.create({ lead: lead._id, csr: lead.assignedTo, amount, status: "completed" });
    lead.status = "converted"; await lead.save();
    res.status(201).json({ success: true, message: "Lead converted to sale successfully", data: sale });
});

// ===============================
// Excel / Bulk Upload Placeholders
// ===============================
const uploadLeads = asyncWrapper(async (req, res) => { res.status(200).json({ msg: "Upload leads placeholder" }); });
const bulkInsertLeads = asyncWrapper(async (req, res) => { res.status(200).json({ msg: "Bulk insert placeholder" }); });
const parseExcelFile = asyncWrapper(async (req, res) => { res.status(200).json({ msg: "Parse excel placeholder" }); });
const validateExcelData = asyncWrapper(async (req, res) => { res.status(200).json({ msg: "Validate excel placeholder" }); });

// ===============================
// Export all functions
// ===============================
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
    uploadLeads,
    bulkInsertLeads,
    parseExcelFile,
    validateExcelData,
};
