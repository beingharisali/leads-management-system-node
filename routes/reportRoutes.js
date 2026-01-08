const express = require("express");
const router = express.Router();
const { getLeadsGrouped } = require("../controllers/reportController");
const auth = require("../middleware/auth");

router.get("/leads", auth, getLeadsGrouped);

module.exports = router;
