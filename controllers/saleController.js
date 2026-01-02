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

// Export controller
module.exports = { getSalesByCSR };
