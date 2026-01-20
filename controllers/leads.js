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
// Get leads by CSR (Admin can view specific CSR leads)
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

    if (filter === "day") startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (filter === "week") {
        const day = now.getDay() || 7;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day + 1);
    } else if (filter === "month") startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else throw new BadRequestError("Invalid filter");

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
    if (!mongoose.Types.ObjectId.isValid(assignedTo)) throw new BadRequestError("Invalid CSR ID");

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
// Update Lead details
// ===============================
const updateLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");

    if (req.user.role === "csr") {
        delete req.body.assignedTo; // CSR cannot re-assign leads
        if (lead.assignedTo.toString() !== req.user.userId) throw new BadRequestError("Unauthorized");
    }

    Object.assign(lead, req.body);
    await lead.save();
    const populatedLead = await lead.populate("assignedTo", "name email role");

    res.status(200).json({ success: true, data: populatedLead });
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
    if (!amount || amount <= 0) throw new BadRequestError("Amount required");

    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");

    if (req.user.role === "csr" && lead.assignedTo.toString() !== req.user.userId)
        throw new BadRequestError("Unauthorized");

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
// Upload Excel Array (CSR Dashboard - FIXED 400 ERROR)
// ===============================
const uploadLeads = asyncWrapper(async (req, res) => {
    const { leads, assignedTo, csrId } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0)
        throw new BadRequestError("No leads provided or invalid format");

    // Logic: Identify target CSR ID correctly
    const finalCsrId = req.user.role === "csr" ? req.user.userId : (csrId || assignedTo);

    if (!finalCsrId || !mongoose.Types.ObjectId.isValid(finalCsrId))
        throw new BadRequestError("A valid CSR ID is required for assignment");

    const createdBy = req.user.userId;

    // Mapping leads to match your Excel columns (Name, Course, Phone)
    const processedLeads = leads
        .map((l) => {
            const name = l.name || l.Name || "";
            const phone = l.phone || l.Phone || "";
            const course = l.course || l.Course || "N/A";

            return {
                name: String(name).trim(),
                phone: String(phone).trim(),
                course: String(course).trim(),
                source: "Excel Upload",
                assignedTo: finalCsrId,
                createdBy,
                status: "new",
            };
        })
        .filter((l) => l.name !== "" && l.phone !== ""); // Basic validation filter

    if (processedLeads.length === 0) {
        throw new BadRequestError("No valid leads found in data. Check your Excel headers.");
    }

    // Optional: Check for existing leads with same phone number to avoid duplicates
    const phoneNumbers = processedLeads.map(l => l.phone);
    const existingLeads = await Lead.find({ phone: { $in: phoneNumbers } }).select('phone');
    const existingPhones = new Set(existingLeads.map(l => l.phone));

    const uniqueLeads = processedLeads.filter(l => !existingPhones.has(l.phone));

    if (uniqueLeads.length === 0) {
        throw new BadRequestError("All leads in this file already exist in the database.");
    }

    const insertedLeads = await Lead.insertMany(uniqueLeads);

    res.status(201).json({
        success: true,
        message: `${insertedLeads.length} new leads uploaded successfully. ${processedLeads.length - uniqueLeads.length} duplicates skipped.`,
        count: insertedLeads.length,
    });
});

// ===============================
// Bulk Insert Excel (Admin Direct File Upload)
// ===============================
const bulkInsertLeads = asyncWrapper(async (req, res) => {
    if (!req.file) throw new BadRequestError("No file uploaded");

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    if (!jsonData.length) throw new BadRequestError("Excel file is empty");

    const createdBy = req.user.userId;

    const leadsToInsert = jsonData
        .filter((row) => (row.Name || row.name) && (row.Phone || row.phone))
        .map((row) => ({
            name: String(row.Name || row.name).trim(),
            phone: String(row.Phone || row.phone).trim(),
            course: String(row.Course || row.course || "N/A").trim(),
            source: "Bulk Excel Upload",
            assignedTo: row.assignedTo && mongoose.Types.ObjectId.isValid(row.assignedTo) ? row.assignedTo : null,
            createdBy,
            status: "new",
        }));

    if (!leadsToInsert.length) throw new BadRequestError("No valid data found in Excel");

    const insertedLeads = await Lead.insertMany(leadsToInsert);

    res.status(201).json({
        success: true,
        message: `${insertedLeads.length} leads inserted successfully`,
        count: insertedLeads.length,
    });
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