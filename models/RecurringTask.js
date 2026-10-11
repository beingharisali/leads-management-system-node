const mongoose = require("mongoose");
const { WORKFLOW_KEYS } = require("../config/taskWorkflows");
const { TASK_PRIORITIES } = require("./Task");

// A repeating responsibility. The scheduler (utils/taskScheduler.js) creates a
// normal Task from it on every day it falls on.
const recurringTaskSchema = new mongoose.Schema(
	{
		title: { type: String, required: [true, "Please provide a task title"], trim: true, maxlength: 150 },
		description: { type: String, trim: true, maxlength: 4000, default: "" },
		category: { type: String, enum: WORKFLOW_KEYS, default: "general" },
		priority: { type: String, enum: TASK_PRIORITIES, default: "normal" },
		checklist: [{ type: String, trim: true, maxlength: 200 }],
		requiresApproval: { type: Boolean, default: true },

		assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: [true, "Please choose who the task is for"] },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

		frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: [true, "Please choose how often it repeats"] },
		// weekly: 0 = Sunday ... 6 = Saturday
		weekday: { type: Number, min: 0, max: 6 },
		// monthly: 1-31 (falls on the month's last day in shorter months)
		dayOfMonth: { type: Number, min: 1, max: 31 },
		// daily: skip Sundays (the institute's day off)
		skipSundays: { type: Boolean, default: false },
		// Deadline on each occurrence day, server-local "HH:mm"
		dueTime: { type: String, default: "18:00", match: [/^([01]\d|2[0-3]):[0-5]\d$/, "Deadline time must be HH:mm"] },

		startDate: { type: Date, required: true },
		endDate: { type: Date },
		active: { type: Boolean, default: true },

		lastGeneratedKey: { type: String },
	},
	{ timestamps: true }
);

recurringTaskSchema.index({ active: 1 });

module.exports = mongoose.models.RecurringTask || mongoose.model("RecurringTask", recurringTaskSchema);
