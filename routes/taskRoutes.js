const express = require("express");
const router = express.Router();

const { auth, authorizeRoles } = require("../middleware/authentication");
const { taskProofUpload } = require("../middleware/taskUpload");
const {
	getMeta,
	getTeam,
	getTasks,
	getTask,
	createTask,
	updateTask,
	cancelTask,
	updateProgress,
	toggleChecklistItem,
	submitTask,
	reviewTask,
	getDashboard,
} = require("../controllers/tasks");
const {
	getRecurringTasks,
	createRecurringTask,
	updateRecurringTask,
	deleteRecurringTask,
} = require("../controllers/recurringTasks");

const everyone = [auth, authorizeRoles("admin", "csr", "staff")];
const adminOnly = [auth, authorizeRoles("admin")];
// Doing the work: the assignee (the controllers check it is their task)
const teamOnly = [auth, authorizeRoles("csr", "staff")];

// Fixed paths first so they never match "/:id"
router.get("/meta", everyone, getMeta);
router.get("/team", adminOnly, getTeam);
router.get("/dashboard", adminOnly, getDashboard);

router.route("/recurring")
	.get(adminOnly, getRecurringTasks)
	.post(adminOnly, createRecurringTask);
router.route("/recurring/:id")
	.patch(adminOnly, updateRecurringTask)
	.delete(adminOnly, deleteRecurringTask);

router.route("/")
	.get(everyone, getTasks) // team members only get their own tasks
	.post(adminOnly, createTask);

router.route("/:id")
	.get(everyone, getTask)
	.patch(adminOnly, updateTask);

router.post("/:id/cancel", adminOnly, cancelTask);
router.post("/:id/review", adminOnly, reviewTask);
router.patch("/:id/progress", teamOnly, updateProgress);
router.patch("/:id/checklist/:itemId", everyone, toggleChecklistItem);
// Log in first so anonymous requests never reach the uploader
router.post("/:id/submit", teamOnly, taskProofUpload, submitTask);

module.exports = router;
