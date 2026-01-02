// routes/saleRoutes.js

const express = require("express");
const router = express.Router();

// Controller function import karo
const { getSalesByCSR } = require("../controllers/saleController.js");

// Auth middleware import karo
const { auth } = require("../middleware/authentication.js");

// Task-20: Get sales by CSR
router.get("/csr/:csrId", auth, getSalesByCSR);

// Router export karo
module.exports = router;
