const express = require("express");
const router = express.Router();

const {
    convertLeadToSale,
    getSalesByCSR,
    getSalesByDate,
    getAllSales,
    adminGetSalesByCSR
} = require("../controllers/saleController.js");

const { auth } = require("../middleware/authentication.js");


// Task-19: Convert Lead to Sale

router.post("/convert-lead/:id", auth, convertLeadToSale);


// CSR can view their own sales, Admin can view any CSR's sales
router.get("/csr/:csrId", auth, getSalesByCSR);

// CSR sees their own sales by date, Admin can filter all sales by date
router.get("/date", auth, getSalesByDate);


// Task-22: Admin - Get all sales
// ---------------------
router.get("/all", auth, getAllSales);

// ---------------------
// Task-23: Admin - Get sales by CSR
// ---------------------
router.get("/admin/csr/:csrId", auth, adminGetSalesByCSR);

module.exports = router;
