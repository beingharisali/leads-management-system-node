const Lead = require("../models/leads");
const Sale = require("../models/Sale");
const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");

// ================= CSR Dashboard Stats =================
exports.getCsrDashboardStats = async (req, res) => {
    try {
        const csrId = req.user.userId;

        const totalLeads = await Lead.countDocuments({ assignedTo: csrId });
        const totalSales = await Sale.countDocuments({ csr: csrId });
        const conversionRate =
            totalLeads === 0 ? "0%" : `${((totalSales / totalLeads) * 100).toFixed(2)}%`;

        const now = new Date();
        const leadsStats = {
            day: await Lead.countDocuments({
                assignedTo: csrId,
                createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
            }),
            week: await Lead.countDocuments({
                assignedTo: csrId,
                createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
            }),
            month: await Lead.countDocuments({
                assignedTo: csrId,
                createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            }),
        };

        const salesStats = {
            day: await Sale.countDocuments({
                csr: csrId,
                createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
            }),
            week: await Sale.countDocuments({
                csr: csrId,
                createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
            }),
            month: await Sale.countDocuments({
                csr: csrId,
                createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            }),
        };

        res.status(StatusCodes.OK).json({
            success: true,
            totalLeads,
            totalSales,
            conversionRate,
            leadsStats,
            salesStats,
        });
    } catch (error) {
        console.error("CSR Dashboard Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message,
        });
    }
};

// ================= Admin Dashboard Stats =================
exports.getAdminDashboardStats = async (req, res) => {
    try {
        const totalLeads = await Lead.countDocuments();
        const totalSales = await Sale.countDocuments();
        const totalCSRs = await User.countDocuments({ role: "csr" });
        const conversionRate =
            totalLeads === 0 ? "0%" : `${((totalSales / totalLeads) * 100).toFixed(2)}%`;

        const now = new Date();
        const leadsStats = {
            day: await Lead.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }),
            week: await Lead.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }),
            month: await Lead.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }),
        };

        const salesStats = {
            day: await Sale.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }),
            week: await Sale.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }),
            month: await Sale.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }),
        };

        // CSR performance data for Admin Dashboard Table
        const csrs = await User.find({ role: "csr" }).sort({ name: 1 });
        const csrPerformance = await Promise.all(
            csrs.map(async (csr) => {
                const totalLeads = await Lead.countDocuments({ assignedTo: csr._id });
                const totalSales = await Sale.countDocuments({ csr: csr._id });
                const conversionRate = totalLeads === 0 ? "0%" : `${((totalSales / totalLeads) * 100).toFixed(2)}%`;
                return {
                    csrId: csr._id,
                    name: csr.name,
                    totalLeads,
                    totalSales,
                    conversionRate,
                };
            })
        );

        res.status(StatusCodes.OK).json({
            success: true,
            totalLeads,
            totalSales,
            totalCSRs,
            conversionRate,
            leadsStats,
            salesStats,
            csrPerformance,
        });
    } catch (error) {
        console.error("Admin Dashboard Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message,
        });
    }
};

// ================= Admin: CSR Performance Comparison =================
exports.getCsrPerformanceComparison = async (req, res) => {
    try {
        const csrs = await User.find({ role: "csr" }).sort({ name: 1 });
        const performanceData = await Promise.all(
            csrs.map(async (csr) => {
                const totalLeads = await Lead.countDocuments({ assignedTo: csr._id });
                const totalSales = await Sale.countDocuments({ csr: csr._id });
                const conversionRate = totalLeads === 0 ? "0%" : `${((totalSales / totalLeads) * 100).toFixed(2)}%`;

                return {
                    csrId: csr._id,
                    name: csr.name,
                    email: csr.email,
                    totalLeads,
                    totalSales,
                    conversionRate,
                };
            })
        );

        res.status(StatusCodes.OK).json({
            success: true,
            data: performanceData,
        });
    } catch (error) {
        console.error("CSR Performance Comparison Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: error.message,
        });
    }
};
