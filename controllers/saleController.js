// controllers/saleController.js

// Import Sale model
const Sale = require("../models/Sale.js");

/**
 * @desc    Get all sales assigned to a specific CSR
 * @route   GET /api/v1/sale/csr/:csrId
 * @access  Admin or CSR (CSR can see only their own sales)
 */
const getSalesByCSR = async (req, res) => {
    const { csrId } = req.params;

    try {
        // Check if CSR is trying to access someone else's sales
        if (req.user.role === "csr" && req.user.userId !== csrId) {
            return res.status(403).json({
                success: false,
                msg: "Access denied. CSR can only view their own sales.",
            });
        }

        // Fetch sales from DB and populate lead's basic info
        const sales = await Sale.find({ csr: csrId }).populate("lead", "name email");

        // Return success response
        res.status(200).json({
            success: true,
            msg: `Sales fetched successfully for CSR: ${csrId}`,
            data: sales,
        });
    } catch (error) {
        // Error handling
        res.status(500).json({
            success: false,
            msg: "Error occurred in fetching sales by CSR",
            error: error.message,
        });
    }
};

/**
 * @desc    Get all sales filtered by date range
 * @route   GET /api/v1/sale/date?start=YYYY-MM-DD&end=YYYY-MM-DD
 * @access  Admin or CSR (CSR can see only their own sales)
 */
const getSalesByDate = async (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ success: false, msg: "Start and end dates are required" });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    try {
        // Build filter
        let filter = { createdAt: { $gte: startDate, $lte: endDate } };

        // CSR can see only their own sales
        if (req.user.role === "csr") {
            filter.csr = req.user.userId;
        }

        const sales = await Sale.find(filter).populate("lead", "name email");

        res.status(200).json({
            success: true,
            msg: `Sales fetched successfully from ${start} to ${end}`,
            data: sales,
        });
    } catch (error) {
        res.status(500).json({ success: false, msg: "Error fetching sales by date", error: error.message });
    }
};

// Export controllers
module.exports = { getSalesByCSR, getSalesByDate };
