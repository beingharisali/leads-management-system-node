const Lead = require("../models/leads");
const Sale = require("../models/Sale");
const asyncWrapper = require("../middleware/async"); // use asyncWrapper for consistency
const { BadRequestError, NotFoundError, UnauthenticatedError } = require("../errors");

// =======================
// Task-19: Convert Lead to Sale
// =======================
const convertLeadToSale = asyncWrapper(async (req, res) => {
    const { id } = req.params; // Lead ID
    const { amount } = req.body;

    if (!amount) throw new BadRequestError("Amount is required");

    const lead = await Lead.findById(id);
    if (!lead) throw new NotFoundError("Lead not found");

    const assignedToStr = lead.assignedTo.toString();
    const userIdStr = req.user.userId.toString();

    // CSR can only convert their own leads; Admin can convert any lead
    if (req.user.role === "csr" && assignedToStr !== userIdStr) {
        throw new UnauthenticatedError("You cannot convert leads not assigned to you");
    }

    const sale = await Sale.create({
        lead: lead._id,
        csr: req.user.role === "csr" ? userIdStr : assignedToStr, // Admin assigns sale to lead's CSR
        amount,
        status: "completed",
    });

    lead.status = "converted";
    await lead.save();

    res.status(201).json({
        success: true,
        message: "Lead converted to sale successfully",
        data: sale,
    });
});

// =======================
// Task-20: Get sales by CSR
// =======================
const getSalesByCSR = asyncWrapper(async (req, res) => {
    const { csrId } = req.params;

    if (req.user.role === "csr" && req.user.userId.toString() !== csrId.toString()) {
        throw new UnauthenticatedError("Access denied");
    }

    const sales = await Sale.find({ csr: csrId }).populate("lead", "name email");
    res.status(200).json({ success: true, data: sales });
});

// =======================
// Task-21: Get sales by date filter
// =======================
const getSalesByDate = asyncWrapper(async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) throw new BadRequestError("Start and end dates are required");

    const filter = {
        createdAt: { $gte: new Date(start), $lte: new Date(end) },
    };

    if (req.user.role === "csr") {
        filter.csr = req.user.userId;
    }

    const sales = await Sale.find(filter).populate("lead", "name email");
    res.status(200).json({ success: true, data: sales });
});

// =======================
// Task-22: Admin - Get all sales
// =======================
const getAllSales = asyncWrapper(async (req, res) => {
    if (req.user.role !== "admin") throw new UnauthenticatedError("Admin only");

    const sales = await Sale.find()
        .populate("lead", "name email")
        .populate("csr", "name email");

    res.status(200).json({ success: true, total: sales.length, data: sales });
});

// =======================
// Task-23: Admin - Get sales by CSR
// =======================
const adminGetSalesByCSR = asyncWrapper(async (req, res) => {
    if (req.user.role !== "admin") throw new UnauthenticatedError("Admin only");

    const { csrId } = req.params;

    const sales = await Sale.find({ csr: csrId })
        .populate("lead", "name email")
        .populate("csr", "name email");

    res.status(200).json({ success: true, total: sales.length, data: sales });
});

module.exports = {
    convertLeadToSale,
    getSalesByCSR,
    getSalesByDate,
    getAllSales,
    adminGetSalesByCSR,
};
