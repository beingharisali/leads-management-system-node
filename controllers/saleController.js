const Sale = require("../models/Sale.js");

const getSalesByCSR = async (req, res) => {
    const { csrId } = req.params;

    try {
        if (req.user.role === "csr" && req.user.userId !== csrId) {
            return res.status(403).json({
                success: false,
                msg: "Access denied",
            });
        }

        const sales = await Sale.find({ csr: csrId })
            .populate("lead", "name email");

        res.status(200).json({
            success: true,
            data: sales,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            msg: error.message,
        });
    }
};

const getSalesByDate = async (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({
            success: false,
            msg: "Start and end dates are required",
        });
    }

    try {
        const filter = {
            createdAt: {
                $gte: new Date(start),
                $lte: new Date(end),
            },
        };

        if (req.user.role === "csr") {
            filter.csr = req.user.userId;
        }

        const sales = await Sale.find(filter)
            .populate("lead", "name email");

        res.status(200).json({
            success: true,
            data: sales,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            msg: error.message,
        });
    }
};

const getAllSales = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                msg: "Admin only",
            });
        }

        const sales = await Sale.find()
            .populate("lead", "name email")
            .populate("csr", "name email");

        res.status(200).json({
            success: true,
            total: sales.length,
            data: sales,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            msg: error.message,
        });
    }
};

module.exports = {
    getSalesByCSR,
    getSalesByDate,
    getAllSales,
};
