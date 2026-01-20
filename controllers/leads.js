const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Lead = require("../models/leads.js");
const Sale = require("../models/Sale.js");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, NotFoundError } = require("../errors");

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
        throw new BadRequestError("Access denied");

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
// Update Lead
// ===============================
const updateLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");

    if (req.user.role === "csr") {
        delete req.body.assignedTo;
        if (lead.assignedTo.toString() !== req.user.userId) throw new BadRequestError("Unauthorized");
    }

    Object.assign(lead, req.body);
    await lead.save();

    const updatedLead = await Lead.findById(lead._id).populate("assignedTo", "name email role");
    res.status(200).json({ success: true, data: updatedLead });
});

// ===============================
// Delete Lead
// ===============================
const deleteLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");

    if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId)
        throw new BadRequestError("Unauthorized");

    await lead.deleteOne();
    res.status(200).json({ success: true, message: "Lead deleted successfully" });
});

// ===============================
// Convert Lead to Sale
// ===============================
const convertLeadToSale = asyncWrapper(async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount <= 0) throw new BadRequestError("Valid amount is required");

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

    res.status(201).json({ success: true, data: sale });
});

// ===============================
// Upload Leads (Array / CSR Dashboard)
// ===============================
const uploadLeads = asyncWrapper(async (req, res) => {
    const { leads, csrId } = req.body;
    if (!leads || !Array.isArray(leads)) throw new BadRequestError("Invalid format");

    const assignTo = req.user.role === "csr" ? req.user.userId : csrId;
    if (!assignTo) throw new BadRequestError("CSR ID required");

    const processed = leads.map(l => ({
        name: String(l.name || l.Name || "").trim(),
        phone: String(l.phone || l.Phone || "").trim().replace(/\s/g, ""),
        course: String(l.course || l.Course || "N/A").trim(),
        assignedTo: assignTo,
        createdBy: req.user.userId,
        status: "new",
        source: "Excel Upload"
    })).filter(l => l.name && l.phone);

    try {
        const inserted = await Lead.insertMany(processed, { ordered: false });
        res.status(201).json({ success: true, count: inserted.length });
    } catch (error) {
        res.status(201).json({ success: true, count: error.result ? error.result.nInserted : 0 });
    }
});

// ===============================
// Bulk Insert Excel (File / Admin)
// ===============================
const bulkInsertLeads = asyncWrapper(async (req, res) => {
    if (!req.file) throw new BadRequestError("No file uploaded");

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "", raw: false });

    const leadsToInsert = jsonData
        .filter(row => (row.Name || row.name || row.NAME) && (row.Phone || row.phone || row.PHONE))
        .map(row => ({
            name: String(row.Name || row.name || row.NAME).trim(),
            phone: String(row.Phone || row.phone || row.PHONE).trim().replace(/\s/g, ""),
            course: String(row.Course || row.course || row.COURSE || "N/A").trim(),
            source: "Bulk Excel Upload",
            assignedTo: req.user.userId,
            createdBy: req.user.userId,
            status: "new",
        }));

    try {
        const inserted = await Lead.insertMany(leadsToInsert, { ordered: false });
        res.status(201).json({ success: true, count: inserted.length });
    } catch (error) {
        res.status(201).json({ success: true, count: error.result ? error.result.nInserted : 0 });
    }
});

// ===============================
// Exports
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