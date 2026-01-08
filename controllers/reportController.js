// controllers/reportController.js
const Lead = require("../models/leads");
const Sale = require("../models/Sale");

// ================= Leads Grouped =================
const getLeadsGrouped = async (req, res) => {
    try {
        const { type } = req.query;

        // CSR users only see their own leads
        const matchStage =
            req.user.role === "csr"
                ? { assignedTo: req.user.id } // change field if needed
                : {};

        let groupId;

        if (type === "day") {
            groupId = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        } else if (type === "week") {
            groupId = { $week: "$createdAt" };
        } else {
            groupId = { $month: "$createdAt" };
        }

        const data = await Lead.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: groupId,
                    totalLeads: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
};

// ================= Sales Grouped =================
const getSalesGrouped = async (req, res) => {
    try {
        const { type } = req.query;

        const matchStage =
            req.user.role === "csr"
                ? { csr: req.user.id }
                : {};

        let groupId;

        if (type === "day") {
            groupId = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        } else if (type === "week") {
            groupId = { $week: "$createdAt" };
        } else {
            groupId = { $month: "$createdAt" };
        }

        const data = await Sale.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: groupId,
                    totalSales: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
};

module.exports = {
    getLeadsGrouped,
    getSalesGrouped
};
