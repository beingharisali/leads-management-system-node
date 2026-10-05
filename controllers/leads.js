const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Lead = require("../models/leads.js");
const { CLOSED_STATUSES, FOLLOW_UP_STATUSES, AUTO_ROLLOVER_STATUSES, startOfDay, tomorrowStart } = require("../models/leads.js");
const Sale = require("../models/Sale.js");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, NotFoundError, UnauthenticatedError, ForbiddenError } = require("../errors");

// Builds the end-of-window cutoff for the day/week/month "due" filters.
// Every window is inclusive of anything already overdue (followUpDate in
// the past), so a lead a CSR didn't get to never silently disappears - it
// just keeps showing up until it's actually closed (Paid/Not Interested).
const dueWindowEnd = (filter) => {
    const end = startOfDay(new Date());
    if (filter === "day") {
        // no-op, end of today
    } else if (filter === "week") {
        end.setDate(end.getDate() + 6);
    } else if (filter === "month") {
        end.setDate(end.getDate() + 29);
    } else {
        return null;
    }
    end.setHours(23, 59, 59, 999);
    return end;
};


// ===============================
// Pagination helper
// Opt-in: only kicks in when the caller passes page/limit, so every
// existing call site that expects the full list back (dashboards doing
// client-side aggregation/search) keeps getting the exact same response
// shape. Callers that DO want a bounded page (list views) get one.
// ===============================
const getPagination = (query) => {
    if (query.page === undefined && query.limit === undefined) return null;
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

// lean() skips Mongoose's schema defaults, so older leads saved before a
// field existed (e.g. isUrgent) would come back without it. Fill them in
// the same way a full document would.
const LEAD_DEFAULTS = Object.entries(Lead.schema.paths)
    .filter(([path, type]) => path !== "_id" && type.defaultValue !== undefined)
    .map(([path, type]) => [path, type.defaultValue]);

const withDefaults = (leads) => {
    for (const lead of leads) {
        for (const [path, value] of LEAD_DEFAULTS) {
            if (lead[path] === undefined) lead[path] = typeof value === "function" ? value() : value;
        }
    }
    return leads;
};

// Runs a Lead.find(filter) query, applying pagination only if requested;
// otherwise returns every match, same as before pagination existed.
// lean(): plain objects instead of full Mongoose documents - much faster
// to build and serialise for large lists (no client reads the `id` virtual).
const findLeads = async (filter, pagination) => {
    let query = Lead.find(filter)
        .populate("assignedTo", "name email role")
        .lean();

    if (!pagination) {
        // The full list's length is the total - no separate count query
        const leads = withDefaults(await query.sort({ isUrgent: -1, createdAt: -1 })); // urgent leads pinned first
        return { success: true, count: leads.length, data: leads };
    }

    // _id breaks ties between leads with the same createdAt (an Excel import
    // saves a whole batch in the same millisecond) so no lead shows up on
    // two pages or is skipped between them. Ascending _id = the order they
    // were saved in, same as the full list returns ties.
    query = query
        .sort({ isUrgent: -1, createdAt: -1, _id: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit);

    const [leads, totalCount] = await Promise.all([
        query,
        Lead.countDocuments(filter),
    ]);

    return buildPaginatedResponse(withDefaults(leads), totalCount, pagination.page, pagination.limit);
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ===============================
// Get all leads (Admin Only)
// Optional filters for the admin dashboard's lead table:
//   csrId  - only this agent's leads
//   search - name contains it (any case) or phone contains it
//   status - exact status (any case)
// ===============================
const getAllLeads = asyncWrapper(async (req, res) => {
    const { csrId, search, status } = req.query;
    const conditions = [];

    if (csrId) {
        if (!mongoose.Types.ObjectId.isValid(csrId)) throw new BadRequestError("Invalid CSR ID");
        conditions.push({ assignedTo: csrId });
    }
    if (search) {
        const pattern = escapeRegex(String(search));
        conditions.push({
            $or: [
                { name: { $regex: pattern, $options: "i" } },
                { phone: { $regex: pattern } },
            ],
        });
    }
    if (status && status !== "all") {
        const wanted = String(status).toLowerCase();
        // Any case, like the dashboard always compared; a lead with no
        // status is shown as "new", so it matches "new" too
        const byStatus = { status: { $regex: `^${escapeRegex(wanted)}$`, $options: "i" } };
        conditions.push(wanted === "new"
            ? { $or: [byStatus, { status: { $in: [null, ""] } }] }
            : byStatus);
    }

    const filter = conditions.length ? { $and: conditions } : {};
    res.status(200).json(await findLeads(filter, getPagination(req.query)));
});

// ===============================
// Admin dashboard summary cards: how many leads were created in a date
// window, broken down by status (with the sale amounts per status).
//   from / to - ISO timestamps, both optional (no bound when missing)
// A lead with no status counts as "new", same as the lead list shows it.
// ===============================
const getAdminLeadSummary = asyncWrapper(async (req, res) => {
    const createdAt = { $ne: null };
    for (const [param, op] of [["from", "$gte"], ["to", "$lte"]]) {
        if (!req.query[param]) continue;
        const date = new Date(req.query[param]);
        if (Number.isNaN(date.getTime())) throw new BadRequestError(`Invalid '${param}' date`);
        createdAt[op] = date;
    }

    const rows = await Lead.aggregate([
        { $match: { createdAt } },
        {
            $group: {
                _id: {
                    $let: {
                        vars: { s: { $toLower: { $ifNull: ["$status", ""] } } },
                        in: { $cond: [{ $eq: ["$$s", ""] }, "new", "$$s"] },
                    },
                },
                count: { $sum: 1 },
                revenue: { $sum: "$saleAmount" },
            },
        },
    ]);

    const byStatus = {};
    let total = 0;
    for (const row of rows) {
        byStatus[row._id] = { count: row.count, revenue: row.revenue || 0 };
        total += row.count;
    }

    res.status(200).json({ success: true, data: { total, byStatus } });
});

// 2. Get leads by CSR (Used by Admin Sidebar)
const getLeadsByCSR = asyncWrapper(async (req, res) => {
    const { csrId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(csrId)) {
        throw new BadRequestError("Invalid CSR ID");
    }

    res.status(200).json(await findLeads({ assignedTo: csrId }, getPagination(req.query)));
});

// Urgent leads only (small payload - polled by the CSR portal to raise
// "call these now" alerts). CSRs always get their own; an admin passes
// ?csrId= to see one agent's, or gets every urgent lead without it.
const getUrgentLeads = asyncWrapper(async (req, res) => {
    const filter = { status: "urgent" };

    if (req.user.role === "csr") {
        filter.assignedTo = req.user.userId;
    } else if (req.query.csrId) {
        if (!mongoose.Types.ObjectId.isValid(req.query.csrId)) {
            throw new BadRequestError("Invalid CSR ID");
        }
        filter.assignedTo = req.query.csrId;
    }

    const leads = await Lead.find(filter)
        .select("name phone course city remarks status statusUpdatedAt assignedTo createdAt")
        .sort({ statusUpdatedAt: -1 })
        .lean();

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

    // Date Filtering Logic - based on followUpDate (when the lead is next
    // due), not createdAt. Closed leads (Paid/Not Interested) have no
    // followUpDate so they naturally drop out of these windows. Every
    // window includes anything overdue so a lead never silently vanishes.
    if (filter === "custom" && start && end) {
        query.followUpDate = {
            $ne: null,
            $gte: new Date(new Date(start).setHours(0, 0, 0, 0)),
            $lte: new Date(new Date(end).setHours(23, 59, 59, 999))
        };
    } else if (filter && filter !== "all") {
        const end = dueWindowEnd(filter);
        if (end) query.followUpDate = { $ne: null, $lte: end };
    }

    res.status(200).json(await findLeads(query, getPagination(req.query)));
});

// 4. Get leads by date (due today/this week/this month, based on followUpDate)
const getLeadsByDate = asyncWrapper(async (req, res) => {
    const { filter, csrId } = req.query;

    const end = dueWindowEnd(filter);
    if (!end) throw new BadRequestError("Invalid filter. Use day, week, or month.");

    let query = { followUpDate: { $ne: null, $lte: end } };

    if (req.user.role === "csr") {
        query.assignedTo = req.user.userId;
    } else if (csrId) {
        if (!mongoose.Types.ObjectId.isValid(csrId)) {
            throw new BadRequestError("Invalid CSR ID");
        }
        query.assignedTo = csrId;
    }

    res.status(200).json(await findLeads(query, getPagination(req.query)));
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

    // Column headers are matched case/space-insensitively, so "Course",
    // "course" and " COURSE " in the sheet all map to the same field.
    const cell = (row, header) => {
        const key = Object.keys(row).find(k => k.trim().toLowerCase() === header);
        const value = key !== undefined ? String(row[key]).trim() : "";
        return value || undefined;
    };

    const leadsToInsert = jsonData.map(row => ({
        name: cell(row, "name") || "Unknown",
        phone: String(cell(row, "phone") || "").replace(/[^\d+]/g, ""),
        course: cell(row, "course") || "General",
        assignedTo: csrId,
        createdBy: req.user.userId,
        city: cell(row, "city") || "Unknown",
        source: (cell(row, "source") || "excel").toLowerCase(),
        status: "new",
        // insertMany() skips the save hook that normally schedules this,
        // so set it explicitly - new leads should be due today.
        followUpDate: startOfDay(new Date())
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
    const normalizedStatus = status?.toLowerCase() || "new";

    const leadData = {
        name: name?.trim(),
        phone: cleanPhone,
        course: course || "General",
        assignedTo: assignedTo,
        createdBy: creatorId,
        status: normalizedStatus,
        remarks: remarks || "",
        city: city || "Unknown",
        source: source || "manual",
    };

    // A brand-new open lead should show up in "today" immediately. Not
    // Pick/Busy go straight to tomorrow, a caller-supplied date is only
    // honoured for Interested, and closed statuses never get one.
    if (AUTO_ROLLOVER_STATUSES.includes(normalizedStatus)) {
        leadData.followUpDate = tomorrowStart();
    } else if (followUpDate) {
        if (!FOLLOW_UP_STATUSES.includes(normalizedStatus)) {
            throw new BadRequestError("Follow-up date can only be set when status is Interested");
        }
        leadData.followUpDate = followUpDate;
    } else if (!CLOSED_STATUSES.includes(normalizedStatus)) {
        leadData.followUpDate = startOfDay(new Date());
    }

    if (!leadData.name) throw new BadRequestError("Lead name is required");
    if (leadData.phone.replace(/\D/g, "").length < 10) throw new BadRequestError("Please enter a valid phone number (at least 10 digits).");
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

    const existing = await Lead.findById(req.params.id).select("status").lean();
    if (!existing) throw new NotFoundError("Lead not found");
    const currentStatus = (existing.status || "").toLowerCase();

    // A closed lead (Paid/Not Interested/Wrong Number) stays closed for
    // the agent - only an admin can reopen it.
    if (
        req.user.role === "csr" &&
        CLOSED_STATUSES.includes(currentStatus) &&
        updateData.status &&
        updateData.status !== currentStatus
    ) {
        throw new BadRequestError("This lead is closed and its status can no longer be changed");
    }

    // Follow-up dates can only be picked for Interested leads. Not Pick/Busy
    // are rolled to tomorrow by the model's update hook, so a date sent
    // alongside that status change is simply dropped.
    if (updateData.followUpDate) {
        const effectiveStatus = updateData.status || currentStatus;
        if (AUTO_ROLLOVER_STATUSES.includes(effectiveStatus) && updateData.status) {
            delete updateData.followUpDate;
        } else if (!FOLLOW_UP_STATUSES.includes(effectiveStatus)) {
            throw new BadRequestError("Follow-up date can only be set when status is Interested");
        }
    }

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
    if (req.user.role !== "admin") throw new ForbiddenError("Only an admin can delete all leads.");
    await Lead.deleteMany({});
    res.status(200).json({ success: true, message: "Database Cleared" });
});

const getSingleLead = asyncWrapper(async (req, res) => {
    const lead = await Lead.findById(req.params.id).populate("assignedTo", "name").lean();
    if (!lead) throw new NotFoundError("Lead not found");
    res.status(200).json({ success: true, data: withDefaults([lead])[0] });
});

module.exports = {
    getAdminLeadSummary,
    getUrgentLeads,
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
