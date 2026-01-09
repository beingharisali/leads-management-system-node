const Lead = require("../models/leads");
const Sale = require("../models/Sale");
const asyncWrapper = require("../middleware/async"); // centralized error handling
const { UnauthenticatedError } = require("../errors");

// ================= Leads Grouped =================
const getLeadsGrouped = asyncWrapper(async (req, res) => {
    const { type } = req.query;

    // CSR users only see their own leads
    const matchStage =
        req.user.role === "csr"
            ? { assignedTo: req.user.userId } // use userId consistently
            : {};

    let groupId;
    if (type === "day") {
        groupId = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    } else if (type === "week") {
        groupId = { $isoWeek: "$createdAt" }; // ISO week for consistency
    } else if (type === "month") {
        groupId = { $month: "$createdAt" };
    } else {
        throw new UnauthenticatedError("Invalid type parameter");
    }

    const data = await Lead.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: groupId,
                totalLeads: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    res.status(200).json({ success: true, data });
});

// ================= Sales Grouped =================
const getSalesGrouped = asyncWrapper(async (req, res) => {
    const { type } = req.query;

    const matchStage =
        req.user.role === "csr"
            ? { csr: req.user.userId } // consistent userId
            : {};

    let groupId;
    if (type === "day") {
        groupId = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    } else if (type === "week") {
        groupId = { $isoWeek: "$createdAt" }; // ISO week
    } else if (type === "month") {
        groupId = { $month: "$createdAt" };
    } else {
        throw new UnauthenticatedError("Invalid type parameter");
    }

    const data = await Sale.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: groupId,
                totalSales: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    res.status(200).json({ success: true, data });
});

module.exports = {
    getLeadsGrouped,
    getSalesGrouped,
};
