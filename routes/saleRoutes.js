// routes/saleRoutes.js

const express = require("express");
const router = express.Router();

// ✅ Controller functions import
const { getSalesByCSR, getSalesByDate } = require("../controllers/saleController.js");

// ✅ Auth middleware import
const { auth } = require("../middleware/authentication.js");

// Task-21: Get sales by date filter
router.get("/date", auth, getSalesByDate);

// Task-20: Get sales by CSR
router.get("/csr/:csrId", auth, getSalesByCSR);

// Router export
module.exports = router;
