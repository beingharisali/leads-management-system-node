const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Lead = require("../models/leads.js");
const Sale = require("../models/Sale.js");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, NotFoundError, UnauthenticatedError } = require("../errors");

// 1. Get all leads (Admin Only)
const getAllLeads = asyncWrapper(async (req, res) => {
    const leads = await Lead.find({})
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: leads.length,
        data: leads
    });
});

// 2. Get leads by CSR (Used by Admin Sidebar)
const getLeadsByCSR = asyncWrapper(async (req, res) => {
    const { csrId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(csrId)) {
        throw new BadRequestError("Invalid CSR ID");
    }

    const leads = await Lead.find({ assignedTo: csrId })
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: leads.length, data: leads });
});

// 3. Smart Get Leads (FIXED: Ab yeh Date Filters handle karega)
const getLeads = asyncWrapper(async (req, res) => {
    const { search, filter, start, end } = req.query;

    let query = {};

    // Role based filtering
    if (req.user.role === "csr") {
        query.assignedTo = req.user.userId;
    }

    // Search logic
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { course: { $regex: search, $options: "i" } },
            { city: { $regex: search, $options: "i" } }
        ];
    }

    // Date Filtering Logic (Added to sync with Dashboard)
    if (filter) {
        const now = new Date();
        if (filter === "day") {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query.createdAt = { $gte: today };
        } else if (filter === "week") {
            const lastWeek = new Date();
            lastWeek.setDate(now.getDate() - 7);
            query.createdAt = { $gte: lastWeek };
        } else if (filter === "month") {
            const lastMonth = new Date();
            lastMonth.setMonth(now.getMonth() - 1);
            query.createdAt = { $gte: lastMonth };
        } else if (filter === "custom" && start && end) {
            query.createdAt = {
                $gte: new Date(new Date(start).setHours(0, 0, 0, 0)),
                $lte: new Date(new Date(end).setHours(23, 59, 59, 999))
            };
        }
    }

    const leads = await Lead.find(query)
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: leads.length, data: leads });
});

// 4. Get leads by date
const getLeadsByDate = asyncWrapper(async (req, res) => {
    const { filter } = req.query;
    const now = new Date();
    let startDate = new Date();

    if (filter === "day") startDate.setHours(0, 0, 0, 0);
    else if (filter === "week") startDate.setDate(now.getDate() - 7);
    else if (filter === "month") startDate.setMonth(now.getMonth() - 1);
    else throw new BadRequestError("Invalid filter. Use day, week, or month.");

    let query = { createdAt: { $gte: startDate } };
    if (req.user.role === "csr") query.assignedTo = req.user.userId;

    const leads = await Lead.find(query).populate("assignedTo", "name email role");

    res.status(200).json({ success: true, count: leads.length, data: leads });
});

// 5. Convert Lead to Sale (Fixed: Transactions Removed for Local MongoDB)
const convertLeadToSale = asyncWrapper(async (req, res) => {
    const { amount, remarks, paymentMethod } = req.body;
    const { id } = req.params;

    if (!amount || amount <= 0) throw new BadRequestError("Valid amount is required");

    const lead = await Lead.findById(id);
    if (!lead) throw new NotFoundError("Lead not found");

    const normalizedStatus = lead.status.toLowerCase();
    if (normalizedStatus === 'sale' || normalizedStatus === 'paid') {
        throw new BadRequestError("Lead already converted");
    }

    const sale = await Sale.create({
        lead: lead._id,
        csr: lead.assignedTo,
        amount: Number(amount),
        course: lead.course,
        remarks: remarks || "Direct conversion",
        paymentMethod: paymentMethod || "Bank Transfer"
    });

    const updatedLead = await Lead.findByIdAndUpdate(id, {
        status: "paid",
        saleAmount: Number(amount),
        convertedAt: Date.now(),
        lastUpdatedBy: req.user.userId
    }, { new: true });

    res.status(201).json({
        success: true,
        message: "Sale record created successfully",
        data: sale
    });
});

// 6. Bulk Insert Excel
const bulkInsertLeads = asyncWrapper(async (req, res) => {
    if (!req.file) throw new BadRequestError("No file uploaded");
    const { csrId } = req.body;
    if (!csrId) throw new BadRequestError("Please select a CSR to assign leads");

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const leadsToInsert = jsonData.map(row => ({
        name: (row.Name || row.name || "Unknown").trim(),
        phone: String(row.Phone || row.phone || "").replace(/[^\d+]/g, ""),
        course: (row.Course || row.course || "General").trim(),
        assignedTo: csrId,
        createdBy: req.user.userId,
        city: (row.City || row.city || "Unknown").trim(),
        source: (row.Source || row.source || "excel").toLowerCase(),
        status: "new"
    })).filter(l => l.phone.length >= 10);

    if (leadsToInsert.length === 0) throw new BadRequestError("No valid leads found in file");

    const result = await Lead.insertMany(leadsToInsert, { ordered: false });
    res.status(201).json({ success: true, count: result.length });
});

// 7. Create Lead
const createLead = asyncWrapper(async (req, res) => {
    const { name, phone, course, assignedTo, status, remarks, city, source, followUpDate } = req.body;

    const creatorId = req.user?.userId || req.user?.id;
    if (!creatorId) throw new UnauthenticatedError("Session expired. Please login again.");

    const cleanPhone = phone ? String(phone).replace(/[^\d+]/g, "") : "";

    const leadData = {
        name: name?.trim(),
        phone: cleanPhone,
        course: course || "General",
        assignedTo: assignedTo,
        createdBy: creatorId,
        status: status?.toLowerCase() || "new",
        remarks: remarks || "",
        city: city || "Unknown",
        source: source || "manual",
        followUpDate: followUpDate || null
    };

    if (!leadData.name) throw new BadRequestError("Lead name is required");
    if (leadData.phone.length < 10) throw new BadRequestError("Valid 10-digit phone number is required");
    if (!leadData.assignedTo) throw new BadRequestError("Lead must be assigned to an agent");

    const lead = await Lead.create(leadData);
    res.status(201).json({ success: true, data: lead });
});

// 8. Update Lead
const updateLead = asyncWrapper(async (req, res) => {
    const updateData = { ...req.body };

    if (updateData.status) updateData.status = updateData.status.toLowerCase();
    if (updateData.phone) updateData.phone = String(updateData.phone).replace(/[^\d+]/g, "");

    updateData.lastUpdatedBy = req.user.userId;

    const lead = await Lead.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true
    });

    if (!lead) throw new NotFoundError("Lead not found");
    res.status(200).json({ success: true, data: lead });
});

// 9. Delete Functions
const deleteLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");
    res.status(200).json({ success: true, message: "Lead Deleted" });
});

const deleteAllLeads = asyncWrapper(async (req, res) => {
    if (req.user.role !== "admin") throw new UnauthenticatedError("Only Admin can wipe database");
    await Lead.deleteMany({});
    res.status(200).json({ success: true, message: "Database Cleared" });
});

const getSingleLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id).populate("assignedTo", "name");
    if (!lead) throw new NotFoundError("Lead not found");
    res.status(200).json({ success: true, data: lead });
});

module.exports = {
    createLead,
    getLeads,
    getSingleLead,
    updateLead,
    deleteLead,
    deleteAllLeads,
    convertLeadToSale,
    getAllLeads,
    getLeadsByCSR,
    getLeadsByDate,
    bulkInsertLeads
};
