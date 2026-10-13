// Background loop for the task module:
//  1. creates today's task from every repeating template that falls on today
//  2. flags tasks whose deadline has passed and notifies the admins + assignee
// Both steps are safe to run on several servers at once (unique index /
// conditional updates), and safe to re-run (nothing is created twice).
const Task = require("../models/Task");
const RecurringTask = require("../models/RecurringTask");
const User = require("../models/User");
const logger = require("../middleware/logger");
const { dayKey, atTime } = require("./taskDates");
const { notifyUsers, notifyAdmins } = require("./taskNotify");

const LOOP_INTERVAL_MS = 60 * 1000;

// Weekdays a daily template skips. Templates saved before skipWeekdays existed
// only have the skipSundays flag.
const skippedWeekdays = (template) => {
	if (Array.isArray(template.skipWeekdays) && template.skipWeekdays.length > 0) return template.skipWeekdays;
	return template.skipSundays ? [0] : [];
};

const lastDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

// Whether a repeating template has an occurrence on `date`
const occursOn = (template, date) => {
	const today = dayKey(date);
	if (dayKey(template.startDate) > today) return false;
	if (template.endDate && dayKey(template.endDate) < today) return false;

	switch (template.frequency) {
		case "daily":
			return !skippedWeekdays(template).includes(date.getDay());
		case "weekly":
			return date.getDay() === template.weekday;
		case "monthly":
			// The 31st falls on the last day of shorter months
			return date.getDate() === Math.min(template.dayOfMonth, lastDayOfMonth(date));
		default:
			return false;
	}
};

// Creates the occurrence of `template` for the day of `now` if there is one.
// Returns the created task or null.
const generateOccurrence = async (template, now = new Date()) => {
	const key = dayKey(now);
	if (!template.active || template.lastGeneratedKey === key) return null;

	const markDone = () => RecurringTask.updateOne({ _id: template._id }, { $set: { lastGeneratedKey: key } });

	if (!occursOn(template, now)) {
		await markDone();
		return null;
	}

	const dueAt = atTime(key, template.dueTime || "18:00");
	// A template created after today's deadline starts from its next occurrence,
	// instead of producing a task that is overdue the moment it appears.
	if (template.createdAt && new Date(template.createdAt).getTime() > dueAt.getTime()) {
		await markDone();
		return null;
	}

	const assignee = await User.findById(template.assignedTo).select("name role status").lean();
	if (!assignee || !["csr", "staff"].includes(assignee.role) || assignee.status === "inactive") {
		logger.warn(`Repeating task "${template.title}" skipped for ${key}: assignee missing or inactive.`);
		await markDone();
		return null;
	}

	let task = null;
	try {
		task = await Task.create({
			title: template.title,
			description: template.description,
			category: template.category,
			priority: template.priority,
			requiresApproval: template.requiresApproval,
			checklist: (template.checklist || []).map((text) => ({ text })),
			assignedTo: template.assignedTo,
			createdBy: template.createdBy,
			scheduledFor: key,
			dueAt,
			recurringTask: template._id,
			occurrenceKey: key,
			history: [{ action: "created", by: template.createdBy, at: new Date(), note: `Repeating ${template.frequency} task` }],
		});
	} catch (err) {
		if (err?.code !== 11000) throw err; // 11000: another server already created it
	}

	await markDone();
	if (task) {
		await notifyUsers([task.assignedTo], "task_assigned", `New task: ${task.title} (for ${key})`, task._id);
	}
	return task;
};

const generateRecurringTasks = async (now = new Date()) => {
	const key = dayKey(now);
	const templates = await RecurringTask.find({ active: true, lastGeneratedKey: { $ne: key } }).lean();
	for (const template of templates) {
		try {
			await generateOccurrence(template, now);
		} catch (err) {
			logger.error(`Repeating task "${template.title}" failed to generate: ${err.message}`);
		}
	}
};

const markOverdueTasks = async (now = new Date()) => {
	const due = await Task.find({
		status: { $in: Task.ACTIONABLE_STATUSES },
		dueAt: { $lt: now },
		overdueNotifiedAt: { $exists: false },
	})
		.select("title assignedTo dueAt")
		.populate("assignedTo", "name")
		.limit(500)
		.lean();

	for (const task of due) {
		// Claim it first so two servers never notify the same task twice
		const claimed = await Task.updateOne(
			{ _id: task._id, overdueNotifiedAt: { $exists: false } },
			{
				$set: { overdueNotifiedAt: now, missedDeadline: true },
				$push: { history: { action: "overdue", at: now, note: "Deadline passed" } },
			}
		);
		if (claimed.modifiedCount !== 1) continue;

		const who = task.assignedTo?.name || "A team member";
		await notifyAdmins("task_overdue", `Overdue: ${who} missed the deadline for "${task.title}"`, task._id);
		await notifyUsers([task.assignedTo?._id], "task_overdue", `You missed the deadline for "${task.title}". Please finish it as soon as possible.`, task._id);
	}
};

let running = false;
const runOnce = async () => {
	if (running) return;
	running = true;
	try {
		const now = new Date();
		await generateRecurringTasks(now);
		await markOverdueTasks(now);
	} catch (err) {
		logger.error(`Task scheduler run failed: ${err.message}`);
	} finally {
		running = false;
	}
};

const startTaskSchedulerLoop = () => {
	runOnce();
	setInterval(runOnce, LOOP_INTERVAL_MS).unref();
};

module.exports = { startTaskSchedulerLoop, generateOccurrence, occursOn, runOnce };
