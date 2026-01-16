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
// Task-20: Get sales by CSR (with pagination)
// =======================
const getSalesByCSR = asyncWrapper(async (req, res) => {
    const { csrId } = req.params;

    if (req.user.role === "csr" && req.user.userId.toString() !== csrId.toString()) {
        throw new UnauthenticatedError("Access denied");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { csr: csrId };
    const totalSales = await Sale.countDocuments(filter);

    const sales = await Sale.find(filter)
        .populate("lead", "name email")
        .skip(skip)
        .limit(limit);

    res.status(200).json({
        success: true,
        data: sales,
        page,
        totalPages: Math.ceil(totalSales / limit),
        totalSales,
    });
});

// =======================
// Task-21: Get sales by date filter (with pagination)
// =======================
const getSalesByDate = asyncWrapper(async (req, res) => {
    const { start, end, page = 1, limit = 10 } = req.query;
    if (!start || !end) throw new BadRequestError("Start and end dates are required");

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
        createdAt: { $gte: new Date(start), $lte: new Date(end) },
    };

    if (req.user.role === "csr") {
        filter.csr = req.user.userId;
    }

    const totalSales = await Sale.countDocuments(filter);

    const sales = await Sale.find(filter)
        .populate("lead", "name email")
        .skip(skip)
        .limit(parseInt(limit));

    res.status(200).json({
        success: true,
        data: sales,
        page: parseInt(page),
        totalPages: Math.ceil(totalSales / parseInt(limit)),
        totalSales,
    });
});

// =======================
// Task-22: Admin - Get all sales (with pagination)
// =======================
const getAllSales = asyncWrapper(async (req, res) => {
    if (req.user.role !== "admin") throw new UnauthenticatedError("Admin only");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalSales = await Sale.countDocuments();

    const sales = await Sale.find()
        .populate("lead", "name email")
        .populate("csr", "name email")
        .skip(skip)
        .limit(limit);

    res.status(200).json({
        success: true,
        totalSales,
        page,
        totalPages: Math.ceil(totalSales / limit),
        data: sales,
    });
});

// =======================
// Task-23: Admin - Get sales by CSR (with pagination)
// =======================
const adminGetSalesByCSR = asyncWrapper(async (req, res) => {
    if (req.user.role !== "admin") throw new UnauthenticatedError("Admin only");

    const { csrId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { csr: csrId };
    const totalSales = await Sale.countDocuments(filter);

    const sales = await Sale.find(filter)
        .populate("lead", "name email")
        .populate("csr", "name email")
        .skip(skip)
        .limit(limit);

    res.status(200).json({
        success: true,
        totalSales,
        page,
        totalPages: Math.ceil(totalSales / limit),
        data: sales,
    });
});

module.exports = {
    convertLeadToSale,
    getSalesByCSR,
    getSalesByDate,
    getAllSales,
    adminGetSalesByCSR,
};
