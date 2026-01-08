const Lead = require("../models/leads");

exports.getLeadsGrouped = async (req, res) => {
    try {
        const { type } = req.query; // day | week | month
        const matchStage =
            req.user.role === "csr"
                ? { assignedTo: req.user.id }
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
