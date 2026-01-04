const express = require("express");
const router = express.Router();

const {
    convertLeadToSale,  // Task-19: Convert Lead to Sale
    getSalesByCSR,      // Task-20: Get Sales by CSR
    getSalesByDate,     // Task-21: Get Sales by Date filter
    getAllSales,        // Task-22: Admin - Get All Sales
    adminGetSalesByCSR  // Task-23: Admin - Get Sales by CSR
} = require("../controllers/saleController.js");

const { auth } = require("../middleware/authentication.js");

// ---------------------
// Task-19: Convert Lead to Sale
// ---------------------
// CSR can convert their own leads, Admin can convert any lead
router.post("/convert-lead/:id", auth, convertLeadToSale);

// ---------------------
// Task-20: Get sales by CSR
// ---------------------
// CSR can view their own sales, Admin can view any CSR's sales
router.get("/csr/:csrId", auth, getSalesByCSR);

// ---------------------
// Task-21: Get sales by date filter
// ---------------------
// CSR sees their own sales by date, Admin can filter all sales by date
router.get("/date", auth, getSalesByDate);

// ---------------------
// Task-22: Admin - Get all sales
// ---------------------
router.get("/all", auth, getAllSales);

// ---------------------
// Task-23: Admin - Get sales by CSR
// ---------------------
router.get("/admin/csr/:csrId", auth, adminGetSalesByCSR);

module.exports = router;
