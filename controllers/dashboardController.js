const Lead = require("../models/leads");
const Sale = require("../models/Sale");

// ================= CSR Dashboard Stats =================
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

// ================= Admin Dashboard Stats =================
exports.getAdminDashboardStats = async (req, res) => {
    try {
        // Total leads overall
        const totalLeads = await Lead.countDocuments();
        // Total sales overall
        const totalSales = await Sale.countDocuments();

        // Leads grouped by status
        const leadsByStatus = await Lead.aggregate([
            { $group: { _id: "$status", total: { $sum: 1 } } }
        ]);

        // Leads grouped by CSR
        const leadsByCSR = await Lead.aggregate([
            { $group: { _id: "$assignedTo", total: { $sum: 1 } } }
        ]);

        // Sales grouped by CSR
        const salesByCSR = await Sale.aggregate([
            { $group: { _id: "$csr", totalSales: { $sum: 1 } } }
        ]);

        res.status(200).json({
            success: true,
            totalLeads,
            totalSales,
            leadsByStatus,
            leadsByCSR,
            salesByCSR
        });
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
};
