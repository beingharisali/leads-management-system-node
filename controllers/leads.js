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

    // Safety check for ID
    if (!mongoose.Types.ObjectId.isValid(csrId)) {
        throw new BadRequestError("Invalid CSR ID");
    }

    const leads = await Lead.find({ assignedTo: csrId })
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: leads.length, data: leads });
});

// 3. Smart Get Leads (Handles Admin, CSR, and Search)
const getLeads = asyncWrapper(async (req, res) => {
    const { search } = req.query;

    // Logic: Agar CSR hai toh sirf uski leads, agar Admin hai toh sab (agar assignedTo provide nahi kiya)
    let query = {};
    if (req.user.role === "csr") {
        query.assignedTo = req.user.userId;
    }

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { course: { $regex: search, $options: "i" } },
            { city: { $regex: search, $options: "i" } }
        ];
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

// 5. Convert Lead to Sale (Atomic Transaction)
const convertLeadToSale = asyncWrapper(async (req, res) => {
    const { amount, remarks, paymentMethod } = req.body;
    const { id } = req.params;

    if (!amount || amount <= 0) throw new BadRequestError("Valid amount is required");

    const lead = await Lead.findById(id);
    if (!lead) throw new NotFoundError("Lead not found");

    // Status normalization: Check both 'sale' and 'paid'
    const normalizedStatus = lead.status.toLowerCase();
    if (normalizedStatus === 'sale' || normalizedStatus === 'paid') {
        throw new BadRequestError("Lead already converted");
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const sale = await Sale.create([{
            lead: lead._id,
            csr: lead.assignedTo,
            amount: Number(amount),
            course: lead.course,
            remarks: remarks || "Direct conversion",
            paymentMethod: paymentMethod || "Bank Transfer"
        }], { session });

        await Lead.findByIdAndUpdate(id, {
            status: "paid", // UI consistency ke liye 'paid' use kar rahe hain
            saleAmount: Number(amount),
            convertedAt: Date.now()
        }, { session, new: true });

        await session.commitTransaction();
        res.status(201).json({ success: true, data: sale[0] });
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
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
        status: "new"
    })).filter(l => l.phone.length >= 10);

    if (leadsToInsert.length === 0) throw new BadRequestError("No valid leads found in file");

    const result = await Lead.insertMany(leadsToInsert, { ordered: false });
    res.status(201).json({ success: true, count: result.length });
});

// 7. Create Lead (Fixed Naming & Sanitization)
const createLead = asyncWrapper(async (req, res) => {
    const { name, phone, course, assignedTo, status, remarks, city, followUpDate } = req.body;

    if (!req.user || !req.user.userId) throw new UnauthenticatedError("Auth invalid");

    const cleanPhone = phone ? String(phone).replace(/[^\d+]/g, "") : "";

    const leadData = {
        name: name?.trim(),
        phone: cleanPhone,
        course: course || "General",
        assignedTo: assignedTo,
        createdBy: req.user.userId,
        status: status?.toLowerCase() || "new",
        remarks: remarks || "",
        city: city || "Unknown",
        followUpDate: followUpDate || null // camelCase consistent with Frontend
    };

    if (!leadData.name || leadData.phone.length < 10 || !leadData.assignedTo) {
        throw new BadRequestError("Name, 10-digit Phone, and CSR selection are required.");
    }

    const lead = await Lead.create(leadData);
    res.status(201).json({ success: true, data: lead });
});

// 8. Update Lead
const updateLead = asyncWrapper(async (req, res) => {
    const updateData = { ...req.body };

    if (updateData.status) updateData.status = updateData.status.toLowerCase();
    if (updateData.phone) updateData.phone = String(updateData.phone).replace(/[^\d+]/g, "");

    // Ensure naming consistency for dates
    if (updateData.followUpDate) updateData.followUpDate = updateData.followUpDate;

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
    if (req.user.role !== "admin") throw new UnauthenticatedError("Unauthorized");
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