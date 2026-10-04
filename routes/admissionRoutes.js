const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
	getPublicForm,
	submitPublicForm,
	getMyAdmissionLink,
	getMyAdmissions,
	getUnseenAdmissions,
	markAdmissionsSeen,
	markAdmissionPaid,
} = require("../controllers/admission");
const { auth, authorizeRoles } = require("../middleware/authentication");
const { admissionUpload, paymentUpload } = require("../middleware/admissionUpload");

// The form is public, so cap how often one IP can load and submit it.
const viewLimiter = rateLimit({
	windowMs: 60 * 1000,
	limit: 60,
	standardHeaders: true,
	legacyHeaders: false,
	message: { msg: "Too many requests. Please wait a minute and try again." },
});

// Generous because students often submit together from one network (e.g.
// campus Wi-Fi), which all counts as one IP.
const submitLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	standardHeaders: true,
	legacyHeaders: false,
	message: { msg: "Too many submissions from this device. Please try again later." },
});

// ---- Public form (shared by CSRs) ----
router.get("/form/:code", viewLimiter, getPublicForm);
router.post("/form/:code", submitLimiter, admissionUpload, submitPublicForm);

// ---- CSR ----
router.get("/my-link", auth, authorizeRoles("csr"), getMyAdmissionLink);
router.get("/mine", auth, authorizeRoles("csr"), getMyAdmissions);
router.get("/notifications", auth, authorizeRoles("csr"), getUnseenAdmissions);
router.post("/notifications/seen", auth, authorizeRoles("csr"), markAdmissionsSeen);
router.post("/:id/payment", auth, authorizeRoles("csr"), paymentUpload, markAdmissionPaid);

module.exports = router;
