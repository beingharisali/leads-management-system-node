const express = require("express");
const router = express.Router();

const {
    getSalesByCSR,
    getSalesByDate,
    getAllSales
} = require("../controllers/saleController.js");

const { auth } = require("../middleware/authentication.js");

router.get("/all", auth, getAllSales);
router.get("/date", auth, getSalesByDate);
router.get("/csr/:csrId", auth, getSalesByCSR);

module.exports = router;
