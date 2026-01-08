const Lead = require("../models/leads");
const Sale = require("../models/Sale");

exports.getCsrDashboardStats = async (req, res) => {
    try {
        const csrId = req.user.id;

        const totalLeads = await Lead.countDocuments({ assignedTo: csrId });
        const totalSales = await Sale.countDocuments({ csr: csrId });

        const conversionRate =
            totalLeads === 0 ? 0 : ((totalSales / totalLeads) * 100).toFixed(2);

        res.status(200).json({
            success: true,
            totalLeads,
            totalSales,
            conversionRate: `${conversionRate}%`
        });
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
};
