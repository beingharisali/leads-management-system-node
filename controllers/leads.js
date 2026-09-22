const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Lead = require("../models/leads.js");
const Sale = require("../models/Sale.js");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, NotFoundError } = require("../errors");

// ===============================
// Pagination helper
// Keeps every list endpoint bounded so a growing leads collection
// never gets shipped to the client (and the DB) in a single response.
// ===============================
const getPagination = (query) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

const buildPaginatedResponse = (data, totalCount, page, limit) => ({
    success: true,
    data,
    count: data.length,
    totalCount,
    page,
    totalPages: Math.max(Math.ceil(totalCount / limit), 1),
});

// ===============================
// Get all leads (Admin Only)
// ===============================
const getAllLeads = asyncWrapper(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);

    const [leads, totalCount] = await Promise.all([
        Lead.find({})
            .populate("assignedTo", "name email role")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Lead.countDocuments({}),
    ]);

    res.status(200).json(buildPaginatedResponse(leads, totalCount, page, limit));
});

// ===============================
// Get leads by CSR (Admin view specific CSR)
// ===============================
const getLeadsByCSR = asyncWrapper(async (req, res) => {
    const csrId = req.user.role === "csr" ? req.user.userId : req.params.csrId;

    if (!mongoose.Types.ObjectId.isValid(csrId)) {
        throw new BadRequestError("Invalid CSR ID");
    }

    const { page, limit, skip } = getPagination(req.query);
    const filter = { assignedTo: csrId };

    const [leads, totalCount] = await Promise.all([
        Lead.find(filter)
            .populate("assignedTo", "name email role")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Lead.countDocuments(filter),
    ]);

    res.status(200).json(buildPaginatedResponse(leads, totalCount, page, limit));
});

// ===============================
// Get leads for logged-in CSR
// ===============================
const getLeads = asyncWrapper(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { assignedTo: req.user.userId };

    const [leads, totalCount] = await Promise.all([
        Lead.find(filter)
            .populate("assignedTo", "name email role")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Lead.countDocuments(filter),
    ]);

    res.status(200).json(buildPaginatedResponse(leads, totalCount, page, limit));
});

// ===============================
// Get leads by date filter (Day/Week/Month)
// CSR: always scoped to their own leads.
// Admin: sees all leads, or a specific CSR's leads via ?csrId=
// ===============================
const getLeadsByDate = asyncWrapper(async (req, res) => {
    const { filter, csrId } = req.query;
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

    const match = { createdAt: { $gte: startDate } };

    if (req.user.role === "csr") {
        match.assignedTo = req.user.userId;
    } else if (csrId) {
        if (!mongoose.Types.ObjectId.isValid(csrId)) {
            throw new BadRequestError("Invalid CSR ID");
        }
        match.assignedTo = csrId;
    }

    const { page, limit, skip } = getPagination(req.query);

    const [leads, totalCount] = await Promise.all([
        Lead.find(match)
            .populate("assignedTo", "name email role")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Lead.countDocuments(match),
    ]);

    res.status(200).json(buildPaginatedResponse(leads, totalCount, page, limit));
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
// UPDATE LEAD (FIXED & SECURE)
// ===============================
const updateLead = asyncWrapper(async (req, res) => {
    const { id } = req.params;

    // Check if lead exists
    const lead = await Lead.findById(id);
    if (!lead) throw new NotFoundError("Lead not found");

    // Authorization check for CSR
    if (req.user.role === "csr") {
        if (lead.assignedTo.toString() !== req.user.userId) {
            throw new BadRequestError("Unauthorized to edit this lead");
        }
        // CSR ko assignedTo change nahi karne dena
        delete req.body.assignedTo;
        delete req.body._id; // ID cannot be updated
    }

    // Use findByIdAndUpdate for better stability with populated fields
    const updatedLead = await Lead.findByIdAndUpdate(
        id,
        { $set: req.body },
        { new: true, runValidators: true }
    ).populate("assignedTo", "name email role");

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
// Convert Lead to Sale (FIXED)
// ===============================
const convertLeadToSale = asyncWrapper(async (req, res) => {
    const { amount } = req.body;
    const { id } = req.params;

    if (!amount || isNaN(amount) || amount <= 0) {
        throw new BadRequestError("A valid numeric amount greater than 0 is required");
    }

    const lead = await Lead.findById(id);
    if (!lead) throw new NotFoundError("Lead not found");

    // CSR Check
    if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId) {
        throw new BadRequestError("Unauthorized");
    }

    const sale = await Sale.create({
        lead: lead._id,
        csr: lead.assignedTo,
        amount: Number(amount),
        status: "completed",
    });

    // Update status using findOneAndUpdate to avoid populate errors during save()
    const updatedLead = await Lead.findByIdAndUpdate(
        id,
        { status: "converted", saleAmount: Number(amount) },
        { new: true }
    );

    res.status(201).json({ success: true, data: sale });
});

// ===============================
// Upload Leads (Array)
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
// Bulk Insert Excel
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

    const leadsToInsert = jsonData
        .filter(row => (row.Name || row.name || row.NAME) && (row.Phone || row.phone || row.PHONE))
        .map(row => ({
            name: String(row.Name || row.name || row.NAME).trim(),
            phone: String(row.Phone || row.phone || row.PHONE).trim().replace(/\s/g, ""),
            course: String(row.Course || row.course || row.COURSE || "N/A").trim(),
            source: "Bulk Excel Upload",
            assignedTo: csrId,
            createdBy: req.user.userId,
            status: "new",
        }));

    try {
        const inserted = await Lead.insertMany(leadsToInsert, { ordered: false });
        res.status(201).json({ success: true, count: inserted.length });
    } catch (error) {
        res.status(201).json({
            success: true,
            count: error.result ? error.result.nInserted : 0,
            message: "Import finished with some entries skip or partial success"
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
    convertLeadToSale,
    getAllLeads,
    getLeadsByCSR,
    uploadLeads,
    bulkInsertLeads,
};