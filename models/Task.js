const mongoose = require("mongoose");
const { WORKFLOW_KEYS } = require("../config/taskWorkflows");

// Work the admin assigns to a team member (staff or CSR) for a given day.
// Tasks are never deleted: open work stays on the assignee's list until it is
// resolved, and completed / cancelled tasks remain as history.

// Statuses still waiting on the assignee - these can go overdue.
const ACTIONABLE_STATUSES = ["todo", "in_progress", "blocked"];
// Still open (incl. waiting for the admin's approval).
const OPEN_STATUSES = [...ACTIONABLE_STATUSES, "submitted"];
const CLOSED_STATUSES = ["completed", "cancelled"];
const TASK_STATUSES = [...OPEN_STATUSES, ...CLOSED_STATUSES];
const TASK_PRIORITIES = ["low", "normal", "high"];

const checklistItemSchema = new mongoose.Schema({
	text: { type: String, required: true, trim: true, maxlength: 200 },
	done: { type: Boolean, default: false },
	doneAt: { type: Date },
});

const proofFileSchema = new mongoose.Schema(
	{
		publicId: { type: String, required: true },
		resourceType: { type: String, enum: ["image", "raw"], required: true },
		name: { type: String, required: true },
		mimeType: { type: String },
		size: { type: Number },
	},
	{ _id: true }
);

// One completion attempt: what the assignee sent and the admin's decision.
const submissionSchema = new mongoose.Schema({
	note: { type: String, trim: true, maxlength: 4000, default: "" },
	files: [proofFileSchema],
	submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	submittedAt: { type: Date, default: Date.now },
	// Submitted after the deadline had passed
	late: { type: Boolean, default: false },
	decision: { type: String, enum: ["pending", "approved", "rejected", "auto"], default: "pending" },
	reviewNote: { type: String, trim: true, maxlength: 2000, default: "" },
	reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	reviewedAt: { type: Date },
});

// Permanent audit trail of everything that happened to the task.
const historySchema = new mongoose.Schema(
	{
		action: { type: String, required: true },
		by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		at: { type: Date, default: Date.now },
		note: { type: String, default: "" },
	},
	{ _id: false }
);

const taskSchema = new mongoose.Schema(
	{
		title: { type: String, required: [true, "Please provide a task title"], trim: true, maxlength: 150 },
		description: { type: String, trim: true, maxlength: 4000, default: "" },
		category: { type: String, enum: WORKFLOW_KEYS, default: "general" },
		priority: { type: String, enum: TASK_PRIORITIES, default: "normal" },

		assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: [true, "Please choose who the task is for"] },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

		// The day the work is for ("YYYY-MM-DD", a calendar day so it never
		// shifts with time zones) and the exact deadline.
		scheduledFor: {
			type: String,
			required: [true, "Please choose the day the task is for"],
			match: [/^\d{4}-\d{2}-\d{2}$/, "The task day must be a date (YYYY-MM-DD)"],
		},
		dueAt: { type: Date, required: [true, "Please set a deadline"] },

		// When false, the assignee's submission completes the task directly
		// (still recorded with its proof); otherwise the admin approves it.
		requiresApproval: { type: Boolean, default: true },

		status: { type: String, enum: TASK_STATUSES, default: "todo" },
		blockedReason: { type: String, trim: true, maxlength: 1000, default: "" },
		checklist: [checklistItemSchema],
		submissions: [submissionSchema],
		history: [historySchema],

		startedAt: { type: Date },
		completedAt: { type: Date },
		cancelledAt: { type: Date },

		// Set once the deadline passes with the task still unfinished; stays
		// true afterwards so history shows the deadline was missed.
		missedDeadline: { type: Boolean, default: false },
		overdueNotifiedAt: { type: Date },

		// Repeating tasks: the template and the occurrence day ("YYYY-MM-DD").
		recurringTask: { type: mongoose.Schema.Types.ObjectId, ref: "RecurringTask" },
		occurrenceKey: { type: String },
	},
	{ timestamps: true }
);

// An assignee's open list and the admin's workload/overdue views
taskSchema.index({ assignedTo: 1, status: 1, dueAt: 1 });
taskSchema.index({ status: 1, dueAt: 1 });
taskSchema.index({ category: 1, status: 1 });
// History lists, newest first
taskSchema.index({ status: 1, completedAt: -1 });
// One task per repeating template per day, even with several servers
taskSchema.index(
	{ recurringTask: 1, occurrenceKey: 1 },
	{ unique: true, partialFilterExpression: { recurringTask: { $exists: true } } }
);

taskSchema.virtual("isOverdue").get(function () {
	return ACTIONABLE_STATUSES.includes(this.status) && this.dueAt && this.dueAt.getTime() < Date.now();
});

taskSchema.set("toJSON", { virtuals: true });
taskSchema.set("toObject", { virtuals: true });

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

module.exports = Task;
module.exports.ACTIONABLE_STATUSES = ACTIONABLE_STATUSES;
module.exports.OPEN_STATUSES = OPEN_STATUSES;
module.exports.CLOSED_STATUSES = CLOSED_STATUSES;
module.exports.TASK_STATUSES = TASK_STATUSES;
module.exports.TASK_PRIORITIES = TASK_PRIORITIES;
