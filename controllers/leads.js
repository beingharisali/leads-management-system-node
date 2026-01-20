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
    const leads = await Lead.find({})
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        data: leads,
        count: leads.length,
    });
});

// ===============================
// Get leads by CSR
// ===============================
const getLeadsByCSR = asyncWrapper(async (req, res) => {
    const csrId =
        req.user.role === "csr" ? req.user.userId : req.params.csrId;

    if (!mongoose.Types.ObjectId.isValid(csrId)) {
        throw new BadRequestError("Invalid CSR ID");
    }

    const leads = await Lead.find({ assignedTo: csrId })
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        data: leads,
        count: leads.length,
    });
});

// ===============================
// Get leads for logged-in CSR
// ===============================
const getLeads = asyncWrapper(async (req, res) => {
    const leads = await Lead.find({ assignedTo: req.user.userId })
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        data: leads,
        count: leads.length,
    });
});

// ===============================
// Get leads by date
// ===============================
const getLeadsByDate = asyncWrapper(async (req, res) => {
    const { filter } = req.query;
    const now = new Date();
    let startDate;

    if (filter === "day") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (filter === "week") {
        const day = now.getDay() || 7;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day + 1);
    } else if (filter === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
        throw new BadRequestError("Invalid filter");
    }

    const leads = await Lead.find({
        assignedTo: req.user.userId,
        createdAt: { $gte: startDate },
    }).populate("assignedTo", "name email role");

    res.status(200).json({
        success: true,
        data: leads,
        count: leads.length,
    });
});

// ===============================
// Get single lead
// ===============================
const getSingleLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id).populate(
        "assignedTo",
        "name email role"
    );

    if (!lead) throw new NotFoundError("Lead not found");

    if (
        req.user.role === "csr" &&
        lead.assignedTo._id.toString() !== req.user.userId
    ) {
        throw new BadRequestError("Access denied");
    }

    res.status(200).json({ success: true, data: lead });
});

// ===============================
// Create Lead
// ===============================
const createLead = asyncWrapper(async (req, res) => {
    const { name, phone, course, source, assignedTo: bodyAssignedTo } = req.body;

    if (!name || !phone || !course) {
        throw new BadRequestError("Name, phone and course are required");
    }

    const assignedTo =
        req.user.role === "admin" ? bodyAssignedTo : req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        throw new BadRequestError("Invalid CSR ID");
    }

    const lead = await Lead.create({
        name,
        phone,
        course,
        source,
        assignedTo,
        createdBy: req.user.userId, // ✅ required fix
    });

    const populatedLead = await lead.populate("assignedTo", "name email role");

    res.status(201).json({
        success: true,
        data: populatedLead,
    });
});

// ===============================
// Update lead
// ===============================
const updateLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");

    if (req.user.role === "csr") {
        delete req.body.assignedTo;
        if (lead.assignedTo.toString() !== req.user.userId) {
            throw new BadRequestError("Unauthorized");
        }
    }

    Object.assign(lead, req.body);
    await lead.save();

    const populatedLead = await lead.populate("assignedTo", "name email role");

    res.status(200).json({
        success: true,
        data: populatedLead,
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
// Convert lead to sale
// ===============================
const convertLeadToSale = asyncWrapper(async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount <= 0)
        throw new BadRequestError("Amount required");

    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");

    if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) {
        throw new BadRequestError("Unauthorized");
    }

    const sale = await Sale.create({
        lead: lead._id,
        csr: lead.assignedTo,
        amount,
        status: "completed",
    });

    lead.status = "converted";
    await lead.save();

    res.status(201).json({ success: true, data: sale });
});

// ===============================
// Upload Excel Leads (CSR) - Updated for array payload
// ===============================
const uploadLeads = asyncWrapper(async (req, res) => {
    const { leads, assignedTo } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
        throw new BadRequestError("No leads provided or invalid format");
    }

    // CSR ID (from token) – ignore assignedTo from frontend if user is CSR
    const csrId = req.user.role === "csr" ? req.user.userId : assignedTo;
    if (!csrId || !mongoose.Types.ObjectId.isValid(csrId)) {
        throw new BadRequestError("Invalid CSR ID");
    }

    const createdBy = req.user.userId;

    // Validate and map leads
    const leadsToInsert = leads.map((row) => {
        if (!row.name || !row.phone || !row.course) {
            throw new BadRequestError("Each lead must have name, phone, and course");
        }
        return {
            name: row.name,
            phone: row.phone,
            course: row.course,
            source: row.source || "Excel Upload",
            assignedTo: csrId,
            createdBy,
        };
    });

    // Insert all leads
    await Lead.insertMany(leadsToInsert);

    res.status(200).json({
        success: true,
        message: `${leadsToInsert.length} leads uploaded successfully`,
        count: leadsToInsert.length,
    });
});

// ===============================
// Bulk Insert Excel (ADMIN)
// ===============================
const bulkInsertLeads = asyncWrapper(async (req, res) => {
    if (!req.file) throw new BadRequestError("No file uploaded");

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    if (!jsonData.length) {
        throw new BadRequestError("Excel file is empty");
    }

    const createdBy = req.user.userId;

    const leadsToInsert = jsonData.map((row) => ({
        name: row.name,
        phone: row.phone,
        course: row.course,
        source: row.source || "Bulk Excel Upload",
        assignedTo:
            row.assignedTo && mongoose.Types.ObjectId.isValid(row.assignedTo)
                ? row.assignedTo
                : null,
        createdBy,
    }));

    await Lead.insertMany(leadsToInsert);

    res.status(201).json({
        success: true,
        message: "Bulk leads inserted successfully",
        count: leadsToInsert.length,
    });
});

// ===============================
// EXPORT
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
};
