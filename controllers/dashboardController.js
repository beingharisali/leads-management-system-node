const mongoose = require("mongoose");
const Lead = require("../models/leads");
const Sale = require("../models/Sale");
const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");

const DAY_MS = 24 * 60 * 60 * 1000;

const getPeriodStarts = () => {
    const now = new Date();
    return {
        day: new Date(now.getTime() - DAY_MS),
        week: new Date(now.getTime() - 7 * DAY_MS),
        month: new Date(now.getTime() - 30 * DAY_MS),
    };
};

const sumAmount = (agg) => (agg[0] && agg[0].total) || 0;

const toRate = (totalSales, totalLeads) =>
    totalLeads === 0 ? "0%" : `${((totalSales / totalLeads) * 100).toFixed(2)}%`;

// ================= CSR Dashboard Stats =================
exports.getCsrDashboardStats = async (req, res) => {
    try {
        const csrId = req.user.userId;
        const csrObjectId = new mongoose.Types.ObjectId(csrId);
        const { day, week, month } = getPeriodStarts();

        // All independent reads fired in parallel instead of one-by-one,
        // so this endpoint costs a single round trip instead of 8+.
        const [
            totalLeads,
            totalSales,
            leadsDay,
            leadsWeek,
            leadsMonth,
            salesDay,
            salesWeek,
            salesMonth,
            revenueDayAgg,
            revenueWeekAgg,
            revenueMonthAgg,
            totalRevenueAgg,
        ] = await Promise.all([
            Lead.countDocuments({ assignedTo: csrId }),
            Sale.countDocuments({ csr: csrId }),
            Lead.countDocuments({ assignedTo: csrId, createdAt: { $gte: day } }),
            Lead.countDocuments({ assignedTo: csrId, createdAt: { $gte: week } }),
            Lead.countDocuments({ assignedTo: csrId, createdAt: { $gte: month } }),
            Sale.countDocuments({ csr: csrId, createdAt: { $gte: day } }),
            Sale.countDocuments({ csr: csrId, createdAt: { $gte: week } }),
            Sale.countDocuments({ csr: csrId, createdAt: { $gte: month } }),
            Sale.aggregate([
                { $match: { csr: csrObjectId, createdAt: { $gte: day } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Sale.aggregate([
                { $match: { csr: csrObjectId, createdAt: { $gte: week } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Sale.aggregate([
                { $match: { csr: csrObjectId, createdAt: { $gte: month } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Sale.aggregate([
                { $match: { csr: csrObjectId } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
        ]);

        res.status(StatusCodes.OK).json({
            success: true,
            totalLeads,
            totalSales,
            conversionRate: toRate(totalSales, totalLeads),
            totalRevenue: sumAmount(totalRevenueAgg),
            leadsStats: { day: leadsDay, week: leadsWeek, month: leadsMonth },
            salesStats: { day: salesDay, week: salesWeek, month: salesMonth },
            revenueStats: {
                day: sumAmount(revenueDayAgg),
                week: sumAmount(revenueWeekAgg),
                month: sumAmount(revenueMonthAgg),
            },
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
        const { day, week, month } = getPeriodStarts();

        const [
            totalLeads,
            totalSales,
            totalCSRs,
            leadsDay,
            leadsWeek,
            leadsMonth,
            salesDay,
            salesWeek,
            salesMonth,
            revenueDayAgg,
            revenueWeekAgg,
            revenueMonthAgg,
            totalRevenueAgg,
            csrs,
            leadsByCsrAgg,
            salesByCsrAgg,
        ] = await Promise.all([
            Lead.countDocuments(),
            Sale.countDocuments(),
            User.countDocuments({ role: "csr" }),
            Lead.countDocuments({ createdAt: { $gte: day } }),
            Lead.countDocuments({ createdAt: { $gte: week } }),
            Lead.countDocuments({ createdAt: { $gte: month } }),
            Sale.countDocuments({ createdAt: { $gte: day } }),
            Sale.countDocuments({ createdAt: { $gte: week } }),
            Sale.countDocuments({ createdAt: { $gte: month } }),
            Sale.aggregate([
                { $match: { createdAt: { $gte: day } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Sale.aggregate([
                { $match: { createdAt: { $gte: week } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Sale.aggregate([
                { $match: { createdAt: { $gte: month } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Sale.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
            User.find({ role: "csr" }).sort({ name: 1 }),
            // One grouped query for ALL CSRs instead of a countDocuments per CSR.
            Lead.aggregate([{ $group: { _id: "$assignedTo", count: { $sum: 1 } } }]),
            Sale.aggregate([{ $group: { _id: "$csr", count: { $sum: 1 } } }]),
        ]);

        const leadsCountByCsr = new Map(
            leadsByCsrAgg.map((row) => [String(row._id), row.count])
        );
        const salesCountByCsr = new Map(
            salesByCsrAgg.map((row) => [String(row._id), row.count])
        );

        const csrPerformance = csrs.map((csr) => {
            const csrTotalLeads = leadsCountByCsr.get(String(csr._id)) || 0;
            const csrTotalSales = salesCountByCsr.get(String(csr._id)) || 0;
            return {
                csrId: csr._id,
                name: csr.name,
                totalLeads: csrTotalLeads,
                totalSales: csrTotalSales,
                conversionRate: toRate(csrTotalSales, csrTotalLeads),
            };
        });

        res.status(StatusCodes.OK).json({
            success: true,
            totalLeads,
            totalSales,
            totalCSRs,
            conversionRate: toRate(totalSales, totalLeads),
            totalRevenue: sumAmount(totalRevenueAgg),
            leadsStats: { day: leadsDay, week: leadsWeek, month: leadsMonth },
            salesStats: { day: salesDay, week: salesWeek, month: salesMonth },
            revenueStats: {
                day: sumAmount(revenueDayAgg),
                week: sumAmount(revenueWeekAgg),
                month: sumAmount(revenueMonthAgg),
            },
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
        const [csrs, leadsByCsrAgg, salesByCsrAgg] = await Promise.all([
            User.find({ role: "csr" }).sort({ name: 1 }),
            Lead.aggregate([{ $group: { _id: "$assignedTo", count: { $sum: 1 } } }]),
            Sale.aggregate([{ $group: { _id: "$csr", count: { $sum: 1 } } }]),
        ]);

        const leadsCountByCsr = new Map(
            leadsByCsrAgg.map((row) => [String(row._id), row.count])
        );
        const salesCountByCsr = new Map(
            salesByCsrAgg.map((row) => [String(row._id), row.count])
        );

        const performanceData = csrs.map((csr) => {
            const totalLeads = leadsCountByCsr.get(String(csr._id)) || 0;
            const totalSales = salesCountByCsr.get(String(csr._id)) || 0;
            return {
                csrId: csr._id,
                name: csr.name,
                email: csr.email,
                totalLeads,
                totalSales,
                conversionRate: toRate(totalSales, totalLeads),
            };
        });

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
