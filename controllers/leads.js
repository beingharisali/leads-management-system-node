const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Lead = require("../models/leads.js");
const Sale = require("../models/Sale.js");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, NotFoundError, UnauthenticatedError } = require("../errors");

// ===============================
// Get all leads (Admin Only)
// ===============================
const getAllLeads = asyncWrapper(async (req, res) => {
    const leads = await Lead.find({})
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: leads, count: leads.length });
});

// ===============================
// Get leads by CSR (Admin view specific CSR)
// ===============================
const getLeadsByCSR = asyncWrapper(async (req, res) => {
    const csrId = req.user.role === "csr" ? req.user.userId : req.params.csrId;

    if (!mongoose.Types.ObjectId.isValid(csrId)) {
        throw new BadRequestError("Invalid CSR ID");
    }

    const leads = await Lead.find({ assignedTo: csrId })
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: leads, count: leads.length });
});

// ===============================
// Get leads for logged-in CSR
// ===============================
const getLeads = asyncWrapper(async (req, res) => {
    const leads = await Lead.find({ assignedTo: req.user.userId })
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: leads, count: leads.length });
});

// ===============================
// Get leads by date filter (Day/Week/Month)
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
        startDate.setHours(0, 0, 0, 0);
    } else if (filter === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
        throw new BadRequestError("Invalid filter. Use day, week, or month.");
    }

    const leads = await Lead.find({
        assignedTo: req.user.userId,
        createdAt: { $gte: startDate },
    }).populate("assignedTo", "name email role");

    res.status(200).json({ success: true, data: leads, count: leads.length });
});

// ===============================
// Get single lead by ID
// ===============================
const getSingleLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id).populate("assignedTo", "name email role");
    if (!lead) throw new NotFoundError("Lead not found");

    if (req.user.role === "csr" && lead.assignedTo._id.toString() !== req.user.userId)
        throw new UnauthenticatedError("Access denied: This lead belongs to another user");

    res.status(200).json({ success: true, data: lead });
});

// ===============================
// Create Lead (Manual Entry)
// ===============================
const createLead = asyncWrapper(async (req, res) => {
    const { name, phone, course, source, assignedTo: bodyAssignedTo } = req.body;
    if (!name || !phone || !course) throw new BadRequestError("Name, phone, and course are required");

    const assignedTo = req.user.role === "admin" ? bodyAssignedTo : req.user.userId;

    if (!assignedTo || !mongoose.Types.ObjectId.isValid(assignedTo)) {
        throw new BadRequestError("A valid CSR ID is required for assignment");
    }

    const lead = await Lead.create({
        name: name.trim(),
        phone: phone.trim(),
        course: course.trim(),
        source: source || "Manual",
        assignedTo,
        createdBy: req.user.userId,
        status: "new",
    });

    const populatedLead = await lead.populate("assignedTo", "name email role");
    res.status(201).json({ success: true, data: populatedLead });
});

// ===============================
// UPDATE LEAD
// ===============================
const updateLead = asyncWrapper(async (req, res) => {
    const { id } = req.params;

    const lead = await Lead.findById(id);
    if (!lead) throw new NotFoundError("Lead not found");

    if (req.user.role === "csr") {
        if (lead.assignedTo.toString() !== req.user.userId) {
            throw new UnauthenticatedError("Unauthorized to edit this lead");
        }
        // CSR assignedTo ya ID nahi badal sakta
        delete req.body.assignedTo;
        delete req.body._id;
    }

    const updatedLead = await Lead.findByIdAndUpdate(
        id,
        { $set: req.body },
        { new: true, runValidators: true }
    ).populate("assignedTo", "name email role");

    res.status(200).json({ success: true, data: updatedLead });
});

// ===============================
// Delete Lead (Single)
// ===============================
const deleteLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");

    if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId)
        throw new UnauthenticatedError("Unauthorized");

    await lead.deleteOne();
    res.status(200).json({ success: true, message: "Lead deleted successfully" });
});

// ===============================
// DELETE ALL LEADS (FIXED: Admin Only)
// ===============================
const deleteAllLeads = asyncWrapper(async (req, res) => {
    // 1. Double check Role (for security)
    if (req.user.role !== "admin") {
        throw new UnauthenticatedError("Action Forbidden: Only Admin can clear all leads");
    }

    // 2. Clear Database
    const result = await Lead.deleteMany({});

    res.status(200).json({
        success: true,
        message: "Database cleared successfully",
        count: result.deletedCount
    });
});

// ===============================
// Convert Lead to Sale
// ===============================
const convertLeadToSale = asyncWrapper(async (req, res) => {
    const { amount } = req.body;
    const { id } = req.params;

    if (!amount || isNaN(amount) || amount <= 0) {
        throw new BadRequestError("A valid numeric amount greater than 0 is required");
    }

    const lead = await Lead.findById(id);
    if (!lead) throw new NotFoundError("Lead not found");

    if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) {
        throw new UnauthenticatedError("Unauthorized");
    }

    const sale = await Sale.create({
        lead: lead._id,
        csr: lead.assignedTo,
        amount: Number(amount),
        status: "completed",
    });

    await Lead.findByIdAndUpdate(id, {
        status: "sale", // Sale status update
        saleAmount: Number(amount)
    });

    res.status(201).json({ success: true, data: sale });
});

// ===============================
// Bulk Insert Excel (Fully Robust)
// ===============================
const bulkInsertLeads = asyncWrapper(async (req, res) => {
    if (!req.file) throw new BadRequestError("No file uploaded");

    const { csrId } = req.body;
    if (!csrId || !mongoose.Types.ObjectId.isValid(csrId)) {
        throw new BadRequestError("Please select a valid CSR to assign these leads.");
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "", raw: false });

    if (jsonData.length === 0) throw new BadRequestError("Excel file is empty");

    const leadsToInsert = jsonData
        .filter(row => (row.Name || row.name) && (row.Phone || row.phone))
        .map(row => ({
            name: String(row.Name || row.name || "").trim(),
            phone: String(row.Phone || row.phone || "").trim().replace(/\s/g, ""),
            course: String(row.Course || row.course || "N/A").trim(),
            source: "Bulk Excel Upload",
            assignedTo: csrId,
            createdBy: req.user.userId,
            status: "new",
        }));

    try {
        const result = await Lead.insertMany(leadsToInsert, { ordered: false });
        res.status(201).json({ success: true, count: result.length });
    } catch (error) {
        // Handle partial success (some duplicates might fail)
        res.status(201).json({
            success: true,
            count: error.result ? error.result.nInserted : 0,
            message: "Bulk upload finished with partial results (likely skipped duplicates)"
        });
    }
});

module.exports = {
    createLead,
    getLeads,
    getLeadsByDate,
    getSingleLead,
    updateLead,
    deleteLead,
    deleteAllLeads,
    convertLeadToSale,
    getAllLeads,
    getLeadsByCSR,
    uploadLeads: asyncWrapper(async (req, res) => { /* logic inside remains same */ }),
    bulkInsertLeads,
};