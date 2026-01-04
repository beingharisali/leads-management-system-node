const Lead = require("../models/leads");
const Sale = require("../models/Sale");

// =======================
// Task-19: Convert Lead to Sale
// =======================
const convertLeadToSale = async (req, res) => {
    const { id } = req.params; // Lead ID
    const { amount } = req.body;

    if (!amount) {
        return res.status(400).json({ success: false, msg: "Please provide sale amount" });
    }

    try {
        const lead = await Lead.findById(id);
        if (!lead) {
            return res.status(404).json({ success: false, msg: "Lead not found" });
        }

        const assignedToStr = lead.assignedTo.toString();
        const userIdStr = req.user.userId.toString();

        // CSR can only convert their own leads; Admin can convert any lead
        if (req.user.role === "csr" && assignedToStr !== userIdStr) {
            return res.status(403).json({ success: false, msg: "You cannot convert leads not assigned to you" });
        }

        // Create Sale
        const sale = await Sale.create({
            lead: lead._id,
            csr: req.user.role === "csr" ? userIdStr : assignedToStr, // Admin assigns sale to lead's CSR
            amount,
            status: "completed",
        });

        // Update lead status
        lead.status = "converted";
        await lead.save();

        res.status(201).json({
            success: true,
            msg: "Lead converted to sale successfully",
            data: sale,
        });
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
};

// =======================
// Task-20: Get sales by CSR
// =======================
const getSalesByCSR = async (req, res) => {
    const { csrId } = req.params;

    try {
        if (req.user.role === "csr" && req.user.userId.toString() !== csrId.toString()) {
            return res.status(403).json({ success: false, msg: "Access denied" });
        }

        const sales = await Sale.find({ csr: csrId }).populate("lead", "name email");
        res.status(200).json({ success: true, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
};

// =======================
// Task-21: Get sales by date filter
// =======================
const getSalesByDate = async (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ success: false, msg: "Start and end dates are required" });
    }

    try {
        const filter = {
            createdAt: { $gte: new Date(start), $lte: new Date(end) },
        };

        if (req.user.role === "csr") {
            filter.csr = req.user.userId;
        }

        const sales = await Sale.find(filter).populate("lead", "name email");
        res.status(200).json({ success: true, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
};

// =======================
// Task-22: Admin - Get all sales
// =======================
const getAllSales = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, msg: "Admin only" });
        }

        const sales = await Sale.find()
            .populate("lead", "name email")
            .populate("csr", "name email");

        res.status(200).json({ success: true, total: sales.length, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
};

// =======================
// Task-23: Admin - Get sales by CSR
// =======================
const adminGetSalesByCSR = async (req, res) => {
    const { csrId } = req.params;

    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, msg: "Admin only" });
        }

        const sales = await Sale.find({ csr: csrId })
            .populate("lead", "name email")
            .populate("csr", "name email");

        res.status(200).json({ success: true, total: sales.length, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
};

module.exports = {
    convertLeadToSale,
    getSalesByCSR,
    getSalesByDate,
    getAllSales,
    adminGetSalesByCSR,
};
