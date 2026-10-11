const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const RecurringTask = require("../models/RecurringTask");
const User = require("../models/User");
const { TASK_PRIORITIES } = require("../models/Task");
const { WORKFLOW_KEYS, workflowByKey } = require("../config/taskWorkflows");
const { BadRequestError, NotFoundError } = require("../errors");
const { isDayKey, atTime, dayKey } = require("../utils/taskDates");
const { generateOccurrence } = require("../utils/taskScheduler");

const FREQUENCIES = ["daily", "weekly", "monthly"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const findOr404 = async (id) => {
	if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Repeating task not found.");
	const template = await RecurringTask.findById(id);
	if (!template) throw new NotFoundError("Repeating task not found.");
	return template;
};

const assertAssignee = async (id) => {
	if (!mongoose.isValidObjectId(id)) throw new BadRequestError("Please choose a valid team member.");
	const user = await User.findOne({ _id: id, role: { $in: ["csr", "staff"] } }).select("name status").lean();
	if (!user) throw new BadRequestError("The chosen team member was not found.");
	if (user.status === "inactive") throw new BadRequestError(`${user.name}'s account is deactivated. Activate it before assigning work.`);
};

// Copies the allowed fields from the request onto `target`, validating them.
const applyFields = async (target, body, isNew) => {
	if (isNew || body.title !== undefined) {
		if (!String(body.title || "").trim()) throw new BadRequestError("Please provide a task title.");
		target.title = String(body.title).trim();
	}
	if (body.description !== undefined) target.description = String(body.description).trim();
	if (body.category !== undefined || isNew) target.category = WORKFLOW_KEYS.includes(body.category) ? body.category : "general";
	if (body.priority !== undefined) target.priority = TASK_PRIORITIES.includes(body.priority) ? body.priority : "normal";
	if (body.requiresApproval !== undefined) target.requiresApproval = body.requiresApproval !== false && body.requiresApproval !== "false";
	if (body.skipSundays !== undefined) target.skipSundays = Boolean(body.skipSundays);

	if (body.checklist !== undefined) {
		if (!Array.isArray(body.checklist)) throw new BadRequestError("The checklist must be a list of steps.");
		target.checklist = body.checklist.map((s) => String(s?.text ?? s).trim()).filter(Boolean).slice(0, 30);
	} else if (isNew) {
		target.checklist = workflowByKey(target.category).checklist;
	}

	if (isNew || body.assignedTo !== undefined) {
		await assertAssignee(body.assignedTo);
		target.assignedTo = body.assignedTo;
	}

	if (isNew || body.frequency !== undefined) {
		if (!FREQUENCIES.includes(body.frequency)) throw new BadRequestError("Choose daily, weekly or monthly.");
		target.frequency = body.frequency;
	}
	if (body.weekday !== undefined) target.weekday = Number(body.weekday);
	if (body.dayOfMonth !== undefined) target.dayOfMonth = Number(body.dayOfMonth);

	if (target.frequency === "weekly" && !(Number.isInteger(target.weekday) && target.weekday >= 0 && target.weekday <= 6)) {
		throw new BadRequestError("Choose the day of the week it repeats on.");
	}
	if (target.frequency === "monthly" && !(Number.isInteger(target.dayOfMonth) && target.dayOfMonth >= 1 && target.dayOfMonth <= 31)) {
		throw new BadRequestError("Choose the day of the month it repeats on (1-31).");
	}

	if (body.dueTime !== undefined || isNew) {
		const time = body.dueTime || "18:00";
		if (!TIME_RE.test(time)) throw new BadRequestError("The deadline time must be HH:mm.");
		target.dueTime = time;
	}

	if (body.startDate !== undefined || isNew) {
		const start = body.startDate || dayKey(new Date());
		if (!isDayKey(start)) throw new BadRequestError("Please choose a valid start date.");
		target.startDate = atTime(start);
	}
	if (body.endDate !== undefined) {
		if (body.endDate === null || body.endDate === "") {
			target.endDate = undefined;
		} else {
			if (!isDayKey(body.endDate)) throw new BadRequestError("Please choose a valid end date.");
			target.endDate = atTime(body.endDate);
		}
	}
	if (target.endDate && target.endDate < target.startDate) {
		throw new BadRequestError("The end date can't be before the start date.");
	}
};

// GET /tasks/recurring
const getRecurringTasks = async (req, res) => {
	const templates = await RecurringTask.find({})
		.populate("assignedTo", "name role status")
		.sort({ active: -1, createdAt: -1 })
		.lean();
	res.status(StatusCodes.OK).json({ success: true, data: templates });
};

// POST /tasks/recurring - today's task is created right away if today is a repeat day
const createRecurringTask = async (req, res) => {
	const template = new RecurringTask({ createdBy: req.user.userId, active: true });
	await applyFields(template, req.body || {}, true);
	await template.save();

	const todaysTask = await generateOccurrence(template.toObject());
	res.status(StatusCodes.CREATED).json({ success: true, data: template, createdToday: Boolean(todaysTask) });
};

// PATCH /tasks/recurring/:id - changes apply to future occurrences only
const updateRecurringTask = async (req, res) => {
	const template = await findOr404(req.params.id);
	await applyFields(template, req.body || {}, false);
	if (req.body?.active !== undefined) template.active = Boolean(req.body.active);
	await template.save();
	res.status(StatusCodes.OK).json({ success: true, data: template });
};

// DELETE /tasks/recurring/:id - stops future occurrences; tasks already
// created from it stay (permanent records).
const deleteRecurringTask = async (req, res) => {
	const template = await findOr404(req.params.id);
	await template.deleteOne();
	res.status(StatusCodes.OK).json({ success: true, msg: "Repeating task removed. Tasks it already created are kept." });
};

module.exports = { getRecurringTasks, createRecurringTask, updateRecurringTask, deleteRecurringTask };
