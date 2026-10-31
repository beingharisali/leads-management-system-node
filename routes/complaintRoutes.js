const express = require("express");
const router = express.Router();

const { auth, authorizeRoles } = require("../middleware/authentication");
const { complaintPhotoUpload } = require("../middleware/complaintUpload");
const {
	getMeta,
	getMembers,
	getMyComplaints,
	createComplaint,
	deleteMyComplaint,
	getComplaints,
	getComplaint,
	replyToComplaint,
	updateAdminNote,
	deleteComplaint,
} = require("../controllers/complaints");

// Filing: staff and CSRs
const teamOnly = [auth, authorizeRoles("csr", "staff")];
// The admin side: the admin, or staff with the "complaints" permission
// (checked in the controller)
const reviewers = [auth, authorizeRoles("admin", "staff")];

// Fixed paths first so they never match "/:id"
router.get("/meta", [auth, authorizeRoles("admin", "csr", "staff")], getMeta);
router.get("/members", teamOnly, getMembers);
router.get("/mine", teamOnly, getMyComplaints);
router.delete("/mine/:id", teamOnly, deleteMyComplaint);

router.route("/")
	.get(reviewers, getComplaints)
	// Log in first so anonymous requests never reach the uploader
	.post(teamOnly, complaintPhotoUpload, createComplaint);

router.route("/:id")
	.get(reviewers, getComplaint)
	.delete(reviewers, deleteComplaint);
router.patch("/:id/reply", reviewers, replyToComplaint);
router.patch("/:id/note", reviewers, updateAdminNote);

module.exports = router;
