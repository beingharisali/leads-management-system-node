const Lead = require("../models/leads");
const Sale = require("../models/Sale");
const User = require("../models/User"); // For CSR data

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
        const totalLeads = await Lead.countDocuments();
        const totalSales = await Sale.countDocuments();

        const leadsByStatus = await Lead.aggregate([
            { $group: { _id: "$status", total: { $sum: 1 } } }
        ]);

        const leadsByCSR = await Lead.aggregate([
            { $group: { _id: "$assignedTo", total: { $sum: 1 } } }
        ]);

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

// ================= CSR Performance Comparison (Admin Only) =================
exports.getCsrPerformanceComparison = async (req, res) => {
    try {
        // Get all CSRs
        const csrs = await User.find({ role: "csr" }).select("_id name email");

        const performanceData = await Promise.all(
            csrs.map(async (csr) => {
                const totalLeads = await Lead.countDocuments({ assignedTo: csr._id });
                const totalSales = await Sale.countDocuments({ csr: csr._id });
                const conversionRate =
                    totalLeads === 0 ? 0 : ((totalSales / totalLeads) * 100).toFixed(2);

                return {
                    csrId: csr._id,
                    name: csr.name,
                    email: csr.email,
                    totalLeads,
                    totalSales,
                    conversionRate: `${conversionRate}%`
                };
            })
        );

        res.status(200).json({ success: true, data: performanceData });
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
};
