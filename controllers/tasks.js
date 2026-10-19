const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Task = require("../models/Task");
const User = require("../models/User");
const { ACTIONABLE_STATUSES, OPEN_STATUSES, CLOSED_STATUSES, TASK_STATUSES, TASK_PRIORITIES } = Task;
const { TASK_WORKFLOWS, WORKFLOW_KEYS, workflowByKey } = require("../config/taskWorkflows");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../errors");
const { isDayKey, addDays, startOfDay } = require("../utils/taskDates");
const { notifyUsers, notifyAdmins } = require("../utils/taskNotify");
const { contentMatches, isImageFile } = require("../middleware/taskUpload");
const { isConfigured: filesConfigured, uploadTaskProof, proofUrl, deleteTaskProofs } = require("../utils/taskFiles");

// Account roles that can be given tasks
const TEAM_ROLES = ["csr", "staff"];

const isAdmin = (req) => req.user.role === "admin";
const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);
// A team member the admin made a Team Lead: assigns work to others and
// manages the tasks they assigned
const isTeamLead = (req) => !isAdmin(req) && (req.user.permissions || []).includes("team_lead");

// Admin, or the Team Lead who assigned this task to someone else
const canManage = (req, task) =>
	isAdmin(req)
	|| (isTeamLead(req) && sameId(task.createdBy, req.user.userId) && !sameId(task.assignedTo, req.user.userId));

const assertCanManage = (req, task) => {
	if (!canManage(req, task)) throw new ForbiddenError("Only the admin or the Team Lead who assigned this task can do this.");
};

const assertAdminOrLead = (req) => {
	if (!isAdmin(req) && !isTeamLead(req)) throw new ForbiddenError("You do not have permission to perform this action.");
};

// Team Leads give work to others; their own tasks go through "add my own task"
const assertNotSelf = (req, ids) => {
	if (!isAdmin(req) && ids.some((id) => sameId(id, req.user.userId))) {
		throw new BadRequestError("To add a task for yourself, use New Task in My Tasks.");
	}
};

const isOverdue = (task, now = Date.now()) =>
	ACTIONABLE_STATUSES.includes(task.status) && new Date(task.dueAt).getTime() < now;

const historyEntry = (action, req, note = "") => ({ action, by: req.user.userId, at: new Date(), note });

const findTaskOr404 = async (id) => {
	if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Task not found.");
	const task = await Task.findById(id);
	if (!task) throw new NotFoundError("Task not found.");
	return task;
};

const assertCanSee = (req, task) => {
	if (!isAdmin(req) && !sameId(task.assignedTo, req.user.userId)) {
		throw new ForbiddenError("This task is not assigned to you.");
	}
};

const assertAssignee = (req, task) => {
	if (!sameId(task.assignedTo, req.user.userId)) {
		throw new ForbiddenError("Only the person the task is assigned to can do this.");
	}
};

// Active team members (staff / CSRs) for the given ids, or throws.
const loadAssignees = async (ids) => {
	const unique = [...new Set(ids.map(String))];
	if (unique.length === 0) throw new BadRequestError("Please choose who the task is for.");
	if (!unique.every((id) => mongoose.isValidObjectId(id))) throw new BadRequestError("Please choose a valid team member.");

	const users = await User.find({ _id: { $in: unique }, role: { $in: TEAM_ROLES } }).select("name role status").lean();
	if (users.length !== unique.length) throw new BadRequestError("One of the chosen team members was not found.");

	const inactive = users.find((u) => u.status === "inactive");
	if (inactive) throw new BadRequestError(`${inactive.name}'s account is deactivated. Activate it before assigning work.`);

	return users;
};

const parseDueAt = (value) => {
	const dueAt = new Date(value);
	if (!value || Number.isNaN(dueAt.getTime())) throw new BadRequestError("Please set a valid deadline.");
	return dueAt;
};

const parseChecklist = (value) => {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) throw new BadRequestError("The checklist must be a list of steps.");
	return value
		.map((item) => (typeof item === "string" ? { text: item } : item))
		.map((item) => ({ ...item, text: String(item?.text || "").trim() }))
		.filter((item) => item.text)
		.slice(0, 30);
};

const pickEnum = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

// Shape of a task in list views (no history / proof files, plus helpers)
const summarize = (task, now) => {
	const lastSubmission = task.submissions?.[task.submissions.length - 1];
	const checklist = task.checklist || [];
	return {
		_id: task._id,
		title: task.title,
		category: task.category,
		priority: task.priority,
		status: task.status,
		scheduledFor: task.scheduledFor,
		dueAt: task.dueAt,
		requiresApproval: task.requiresApproval,
		blockedReason: task.blockedReason,
		assignedTo: task.assignedTo,
		createdBy: task.createdBy,
		// Added by the team member for themselves
		selfAssigned: Boolean(task.createdBy) && sameId(task.createdBy, task.assignedTo),
		missedDeadline: task.missedDeadline,
		isOverdue: isOverdue(task, now),
		recurring: Boolean(task.recurringTask),
		checklistDone: checklist.filter((i) => i.done).length,
		checklistTotal: checklist.length,
		submissionCount: task.submissions?.length || 0,
		lastSubmittedAt: lastSubmission?.submittedAt,
		lastDecision: lastSubmission?.decision,
		completedAt: task.completedAt,
		cancelledAt: task.cancelledAt,
		createdAt: task.createdAt,
		updatedAt: task.updatedAt,
	};
};

const LIST_FIELDS = "-history -description -submissions.files -submissions.note -submissions.reviewNote";

/* ================= META ================= */

// GET /tasks/meta - workflow categories (with checklist templates), statuses, priorities
const getMeta = async (req, res) => {
	res.status(StatusCodes.OK).json({
		success: true,
		data: { workflows: TASK_WORKFLOWS, statuses: TASK_STATUSES, priorities: TASK_PRIORITIES },
	});
};

// GET /tasks/team (admin, Team Lead) - staff and CSRs, for assigning work.
// A Team Lead doesn't see themselves in the list.
const getTeam = async (req, res) => {
	assertAdminOrLead(req);
	const filter = { role: { $in: TEAM_ROLES } };
	if (!isAdmin(req)) filter._id = { $ne: req.user.userId };
	const team = await User.find(filter)
		.select("name email role status")
		.sort({ status: 1, name: 1 })
		.lean();
	res.status(StatusCodes.OK).json({ success: true, data: team });
};

/* ================= LIST / DETAIL ================= */

// GET /tasks?scope=open|history|all&assignedTo=&category=&status=&overdue=1&q=&page=&limit=
// Team members only ever get their own tasks.
const getTasks = async (req, res) => {
	const { scope = "open", category, status, overdue, q } = req.query;
	const filter = {};

	if (isAdmin(req)) {
		if (req.query.assignedTo) {
			if (!mongoose.isValidObjectId(req.query.assignedTo)) throw new BadRequestError("Invalid team member.");
			filter.assignedTo = req.query.assignedTo;
		}
	} else if (req.query.view === "assigned") {
		// A Team Lead's "Assigned by me": tasks they gave to others
		assertAdminOrLead(req);
		filter.createdBy = req.user.userId;
		filter.assignedTo = { $ne: req.user.userId };
	} else {
		filter.assignedTo = req.user.userId;
	}

	if (scope === "open") filter.status = { $in: OPEN_STATUSES };
	else if (scope === "history") filter.status = { $in: CLOSED_STATUSES };

	if (status && TASK_STATUSES.includes(status)) {
		filter.status = status;
	}
	if (category && WORKFLOW_KEYS.includes(category)) filter.category = category;
	if (overdue === "1" || overdue === "true") {
		filter.status = { $in: ACTIONABLE_STATUSES };
		filter.dueAt = { $lt: new Date() };
	}
	if (q && String(q).trim()) {
		const safe = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
		filter.title = { $regex: safe, $options: "i" };
	}

	const isHistory = scope === "history";
	const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || (isHistory ? 25 : 500), 1), 500);
	const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

	const [tasks, total] = await Promise.all([
		Task.find(filter)
			.select(LIST_FIELDS)
			.populate("assignedTo", "name role")
			.populate("createdBy", "name role")
			.sort(isHistory ? { updatedAt: -1 } : { dueAt: 1 })
			.skip((page - 1) * limit)
			.limit(limit)
			.lean(),
		Task.countDocuments(filter),
	]);

	const now = Date.now();
	res.status(StatusCodes.OK).json({
		success: true,
		data: tasks.map((t) => summarize(t, now)),
		pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
	});
};

// GET /tasks/:id - full task incl. checklist, proof (signed links) and history
const getTask = async (req, res) => {
	if (!mongoose.isValidObjectId(req.params.id)) throw new NotFoundError("Task not found.");

	const task = await Task.findById(req.params.id)
		.populate("assignedTo", "name role email")
		.populate("createdBy", "name role")
		.populate("submissions.submittedBy", "name")
		.populate("submissions.reviewedBy", "name")
		.populate("history.by", "name role")
		.lean();
	if (!task) throw new NotFoundError("Task not found.");
	if (!canManage(req, task)) assertCanSee(req, task);

	task.isOverdue = isOverdue(task);
	// Lets the page show the edit / cancel / review controls
	task.canManage = canManage(req, task);
	task.submissions = (task.submissions || []).map((s) => ({
		...s,
		files: (s.files || []).map((f) => ({ _id: f._id, name: f.name, mimeType: f.mimeType, size: f.size, resourceType: f.resourceType, url: proofUrl(f) })),
	}));

	res.status(StatusCodes.OK).json({ success: true, data: task });
};

/* ================= ADMIN / TEAM LEAD: CREATE / EDIT / CANCEL ================= */

// POST /tasks - one task per chosen team member (assignedTo may be a list)
const createTask = async (req, res) => {
	assertAdminOrLead(req);
	const { title, description, category, priority, scheduledFor, dueAt, requiresApproval } = req.body;

	if (!String(title || "").trim()) throw new BadRequestError("Please provide a task title.");
	if (!isDayKey(scheduledFor)) throw new BadRequestError("Please choose the day the task is for.");
	const deadline = parseDueAt(dueAt);
	if (deadline.getTime() <= Date.now()) throw new BadRequestError("The deadline must be in the future.");

	const assigneeIds = Array.isArray(req.body.assignedTo) ? req.body.assignedTo : [req.body.assignedTo].filter(Boolean);
	assertNotSelf(req, assigneeIds);
	const assignees = await loadAssignees(assigneeIds);

	const workflow = pickEnum(category, WORKFLOW_KEYS, "general");
	const checklist = parseChecklist(req.body.checklist) ?? workflowByKey(workflow).checklist.map((text) => ({ text }));

	const tasks = await Task.insertMany(
		assignees.map((user) => ({
			title: String(title).trim(),
			description: String(description || "").trim(),
			category: workflow,
			priority: pickEnum(priority, TASK_PRIORITIES, "normal"),
			assignedTo: user._id,
			createdBy: req.user.userId,
			scheduledFor,
			dueAt: deadline,
			requiresApproval: requiresApproval !== false && requiresApproval !== "false",
			checklist: checklist.map((i) => ({ text: i.text })),
			history: [historyEntry("created", req, `Assigned to ${user.name}`)],
		}))
	);

	await Promise.all(
		tasks.map((t) => notifyUsers([t.assignedTo], "task_assigned", `New task: ${t.title} (for ${t.scheduledFor})`, t._id))
	);

	res.status(StatusCodes.CREATED).json({ success: true, data: tasks });
};

/* ================= TEAM MEMBER: ADD OWN TASK ================= */

// POST /tasks/self - a staff member / CSR adds a one-time task for themselves.
// Always assigned to the caller and always needs the admin's approval; once
// created only the admin can edit or cancel it.
const createOwnTask = async (req, res) => {
	const { title, description, category, priority, scheduledFor, dueAt } = req.body;

	if (!String(title || "").trim()) throw new BadRequestError("Please provide a task title.");
	if (!isDayKey(scheduledFor)) throw new BadRequestError("Please choose the day the task is for.");
	const deadline = parseDueAt(dueAt);
	if (deadline.getTime() <= Date.now()) throw new BadRequestError("The deadline must be in the future.");

	const [me] = await loadAssignees([req.user.userId]);

	const workflow = pickEnum(category, WORKFLOW_KEYS, "general");
	const checklist = parseChecklist(req.body.checklist) ?? workflowByKey(workflow).checklist.map((text) => ({ text }));

	const task = await Task.create({
		title: String(title).trim(),
		description: String(description || "").trim(),
		category: workflow,
		priority: pickEnum(priority, TASK_PRIORITIES, "normal"),
		assignedTo: me._id,
		createdBy: me._id,
		scheduledFor,
		dueAt: deadline,
		requiresApproval: true,
		checklist: checklist.map((i) => ({ text: i.text })),
		history: [historyEntry("created", req, `Added by ${me.name} for themselves`)],
	});

	await notifyAdmins("task_self_created", `${me.name} added a task for themselves: ${task.title} (for ${task.scheduledFor})`, task._id);

	res.status(StatusCodes.CREATED).json({ success: true, data: task });
};

// PATCH /tasks/:id - admin (or the Team Lead who assigned it) edits an open task
const updateTask = async (req, res) => {
	const task = await findTaskOr404(req.params.id);
	assertCanManage(req, task);
	if (CLOSED_STATUSES.includes(task.status)) throw new BadRequestError("Completed or cancelled tasks can't be edited.");

	const changes = [];
	const body = req.body;

	if (body.title !== undefined) {
		if (!String(body.title).trim()) throw new BadRequestError("Please provide a task title.");
		task.title = String(body.title).trim();
	}
	if (body.description !== undefined) task.description = String(body.description).trim();
	if (body.category !== undefined) task.category = pickEnum(body.category, WORKFLOW_KEYS, task.category);
	if (body.priority !== undefined) task.priority = pickEnum(body.priority, TASK_PRIORITIES, task.priority);
	if (body.requiresApproval !== undefined) task.requiresApproval = body.requiresApproval !== false && body.requiresApproval !== "false";

	if (body.scheduledFor !== undefined) {
		if (!isDayKey(body.scheduledFor)) throw new BadRequestError("Please choose a valid day.");
		if (body.scheduledFor !== task.scheduledFor) changes.push(`day ${task.scheduledFor} → ${body.scheduledFor}`);
		task.scheduledFor = body.scheduledFor;
	}

	if (body.dueAt !== undefined) {
		const deadline = parseDueAt(body.dueAt);
		if (deadline.getTime() !== task.dueAt.getTime()) {
			changes.push("deadline changed");
			task.dueAt = deadline;
			// A new deadline in the future can be missed (and notified) again;
			// missedDeadline stays as a record that the old one was missed.
			if (deadline.getTime() > Date.now()) task.overdueNotifiedAt = undefined;
		}
	}

	const checklist = parseChecklist(body.checklist);
	if (checklist) {
		const previous = new Map(task.checklist.map((i) => [String(i._id), i]));
		task.checklist = checklist.map((item) => {
			const old = item._id && previous.get(String(item._id));
			return old ? { _id: old._id, text: item.text, done: old.done, doneAt: old.doneAt } : { text: item.text };
		});
	}

	let newAssignee = null;
	if (body.assignedTo !== undefined && !sameId(body.assignedTo, task.assignedTo)) {
		assertNotSelf(req, [body.assignedTo]);
		[newAssignee] = await loadAssignees([body.assignedTo]);
		task.assignedTo = newAssignee._id;
		changes.push(`reassigned to ${newAssignee.name}`);
	}

	task.history.push(historyEntry("updated", req, changes.join(", ")));
	await task.save();

	if (newAssignee) {
		await notifyUsers([newAssignee._id], "task_assigned", `New task: ${task.title} (for ${task.scheduledFor})`, task._id);
	}

	res.status(StatusCodes.OK).json({ success: true, data: task });
};

// POST /tasks/:id/cancel { reason } - stays in history as cancelled
const cancelTask = async (req, res) => {
	const task = await findTaskOr404(req.params.id);
	assertCanManage(req, task);
	if (CLOSED_STATUSES.includes(task.status)) throw new BadRequestError("This task is already closed.");

	const reason = String(req.body?.reason || "").trim();
	task.status = "cancelled";
	task.cancelledAt = new Date();
	task.history.push(historyEntry("cancelled", req, reason));
	await task.save();

	await notifyUsers([task.assignedTo], "task_cancelled", `Task cancelled: ${task.title}${reason ? ` (${reason})` : ""}`, task._id);
	res.status(StatusCodes.OK).json({ success: true, data: task });
};

/* ================= ASSIGNEE: PROGRESS ================= */

// PATCH /tasks/:id/progress { action: start | unblock, reason }
// (unblock stays so tasks blocked before "block" was removed can resume)
const updateProgress = async (req, res) => {
	const task = await findTaskOr404(req.params.id);
	assertAssignee(req, task);

	const { action } = req.body || {};
	const reason = String(req.body?.reason || "").trim();

	if (action === "start") {
		if (task.status !== "todo") throw new BadRequestError("Only a task that hasn't started can be started.");
		task.status = "in_progress";
		task.startedAt = task.startedAt || new Date();
		task.history.push(historyEntry("started", req));
	} else if (action === "block") {
		// Team members can no longer mark a task blocked
		throw new BadRequestError("Tasks can't be marked as blocked. Please complete the task or contact the admin.");
	} else if (action === "unblock") {
		if (task.status !== "blocked") throw new BadRequestError("This task isn't blocked.");
		task.status = "in_progress";
		task.blockedReason = "";
		task.history.push(historyEntry("unblocked", req, reason));
	} else {
		throw new BadRequestError("Unknown action.");
	}

	await task.save();
	res.status(StatusCodes.OK).json({ success: true, data: task });
};

// PATCH /tasks/:id/checklist/:itemId { done } - assignee (or admin) ticks a step
const toggleChecklistItem = async (req, res) => {
	const task = await findTaskOr404(req.params.id);
	assertCanSee(req, task);
	if (!ACTIONABLE_STATUSES.includes(task.status)) throw new BadRequestError("The checklist can only change while the task is open.");

	const item = task.checklist.id(req.params.itemId);
	if (!item) throw new NotFoundError("Checklist step not found.");

	item.done = Boolean(req.body?.done);
	item.doneAt = item.done ? new Date() : undefined;

	if (task.status === "todo" && item.done && !isAdmin(req)) {
		task.status = "in_progress";
		task.startedAt = task.startedAt || new Date();
		task.history.push(historyEntry("started", req));
	}

	await task.save();
	res.status(StatusCodes.OK).json({ success: true, data: task });
};

// POST /tasks/:id/submit (multipart: note, files[]) - completion proof
const submitTask = async (req, res) => {
	const task = await findTaskOr404(req.params.id);
	assertAssignee(req, task);
	if (!ACTIONABLE_STATUSES.includes(task.status)) {
		throw new BadRequestError(task.status === "submitted" ? "This task is already waiting for approval." : "This task is closed.");
	}

	const note = String(req.body?.note || "").trim();
	const files = req.files || [];
	if (!note && files.length === 0) {
		throw new BadRequestError("Please add an explanation or attach proof (document or screenshot).");
	}
	if (files.length > 0 && !filesConfigured()) {
		throw new BadRequestError("File uploads are not set up on the server yet. Please submit a written explanation instead.");
	}
	const bad = files.find((f) => !contentMatches(f));
	if (bad) throw new BadRequestError(`"${bad.originalname}" doesn't look like a valid file of its type.`);

	const uploaded = [];
	try {
		for (const file of files) {
			uploaded.push(await uploadTaskProof(file, task._id, isImageFile(file)));
		}
	} catch (err) {
		await deleteTaskProofs(uploaded);
		throw new BadRequestError("Uploading the proof failed. Please try again.");
	}

	const now = new Date();
	const late = now.getTime() > task.dueAt.getTime();
	const autoComplete = !task.requiresApproval;

	task.submissions.push({
		note,
		files: uploaded,
		submittedBy: req.user.userId,
		submittedAt: now,
		late,
		decision: autoComplete ? "auto" : "pending",
	});

	if (autoComplete) {
		task.status = "completed";
		task.completedAt = now;
	} else {
		task.status = "submitted";
	}
	task.blockedReason = "";
	if (late) task.missedDeadline = true;
	task.history.push(historyEntry(autoComplete ? "completed" : "submitted", req, late ? "after the deadline" : ""));

	try {
		await task.save();
	} catch (err) {
		await deleteTaskProofs(uploaded);
		throw err;
	}

	if (!autoComplete) {
		const message = `${req.user.name || "A team member"} submitted "${task.title}" for approval`;
		await notifyAdmins("task_submitted", message, task._id);
		// The Team Lead who assigned it reviews it too
		if (task.createdBy && !sameId(task.createdBy, task.assignedTo)) {
			const creator = await User.findById(task.createdBy).select("role").lean();
			if (creator && creator.role !== "admin") await notifyUsers([creator._id], "task_submitted", message, task._id);
		}
	}
	res.status(StatusCodes.OK).json({ success: true, data: task });
};

/* ================= ADMIN / TEAM LEAD: REVIEW ================= */

// POST /tasks/:id/review { decision: approve | reject, note }
const reviewTask = async (req, res) => {
	const task = await findTaskOr404(req.params.id);
	assertCanManage(req, task);
	if (task.status !== "submitted") throw new BadRequestError("This task isn't waiting for approval.");

	const submission = task.submissions[task.submissions.length - 1];
	if (!submission || submission.decision !== "pending") throw new BadRequestError("There is no submission to review.");

	const { decision } = req.body || {};
	const note = String(req.body?.note || "").trim();
	if (!["approve", "reject"].includes(decision)) throw new BadRequestError("Choose approve or reject.");
	if (decision === "reject" && !note) throw new BadRequestError("Please tell the team member why it was rejected.");

	const now = new Date();
	submission.decision = decision === "approve" ? "approved" : "rejected";
	submission.reviewNote = note;
	submission.reviewedBy = req.user.userId;
	submission.reviewedAt = now;

	if (decision === "approve") {
		task.status = "completed";
		task.completedAt = now;
	} else {
		// Back to the assignee; it can go overdue again if the deadline passed
		task.status = "in_progress";
	}
	task.history.push(historyEntry(decision === "approve" ? "approved" : "rejected", req, note));
	await task.save();

	await notifyUsers(
		[task.assignedTo],
		decision === "approve" ? "task_approved" : "task_rejected",
		decision === "approve" ? `Approved: ${task.title}` : `Rejected: ${task.title} - ${note}`,
		task._id
	);
	res.status(StatusCodes.OK).json({ success: true, data: task });
};

/* ================= ADMIN: DASHBOARD ================= */

// GET /tasks/dashboard - overdue, blocked, pending approvals, workload per person
const getDashboard = async (req, res) => {
	const now = new Date();
	const nowMs = now.getTime();
	const todayStart = startOfDay(now);
	const tomorrowStart = addDays(todayStart, 1);
	const weekAgo = addDays(todayStart, -7);
	const monthAgo = addDays(todayStart, -30);

	const [team, openTasks, recentlyClosed] = await Promise.all([
		User.find({ role: { $in: TEAM_ROLES } }).select("name role status").sort({ name: 1 }).lean(),
		Task.find({ status: { $in: OPEN_STATUSES } })
			.select(LIST_FIELDS)
			.populate("assignedTo", "name role")
			.sort({ dueAt: 1 })
			.lean(),
		Task.find({ status: "completed", completedAt: { $gte: monthAgo } })
			.select("assignedTo category completedAt missedDeadline")
			.lean(),
	]);

	const open = openTasks.map((t) => summarize(t, nowMs));
	const dueToday = (t) => new Date(t.dueAt) >= todayStart && new Date(t.dueAt) < tomorrowStart;

	const overdueTasks = open.filter((t) => t.isOverdue);
	const blockedTasks = open.filter((t) => t.status === "blocked");
	const pendingApprovals = open
		.filter((t) => t.status === "submitted")
		.sort((a, b) => new Date(a.lastSubmittedAt || 0) - new Date(b.lastSubmittedAt || 0));

	const completedThisWeek = recentlyClosed.filter((t) => new Date(t.completedAt) >= weekAgo);

	const workload = team.map((member) => {
		const mine = open.filter((t) => sameId(t.assignedTo, member._id));
		const doneWeek = completedThisWeek.filter((t) => sameId(t.assignedTo, member._id));
		return {
			_id: member._id,
			name: member.name,
			role: member.role,
			status: member.status,
			open: mine.length,
			dueToday: mine.filter(dueToday).length,
			overdue: mine.filter((t) => t.isOverdue).length,
			blocked: mine.filter((t) => t.status === "blocked").length,
			awaitingApproval: mine.filter((t) => t.status === "submitted").length,
			completedThisWeek: doneWeek.length,
			completedLateThisWeek: doneWeek.filter((t) => t.missedDeadline).length,
		};
	});

	const workflows = TASK_WORKFLOWS.map((w) => {
		const mine = open.filter((t) => t.category === w.key);
		return {
			key: w.key,
			label: w.label,
			open: mine.length,
			overdue: mine.filter((t) => t.isOverdue).length,
			blocked: mine.filter((t) => t.status === "blocked").length,
			completedLast30Days: recentlyClosed.filter((t) => t.category === w.key).length,
			checklistDone: mine.reduce((sum, t) => sum + t.checklistDone, 0),
			checklistTotal: mine.reduce((sum, t) => sum + t.checklistTotal, 0),
		};
	});

	res.status(StatusCodes.OK).json({
		success: true,
		data: {
			summary: {
				open: open.length,
				overdue: overdueTasks.length,
				blocked: blockedTasks.length,
				pendingApprovals: pendingApprovals.length,
				dueToday: open.filter(dueToday).length,
				completedThisWeek: completedThisWeek.length,
			},
			overdueTasks: overdueTasks.slice(0, 50),
			blockedTasks: blockedTasks.slice(0, 50),
			pendingApprovals: pendingApprovals.slice(0, 50),
			workload,
			workflows,
		},
	});
};

module.exports = {
	getMeta,
	getTeam,
	getTasks,
	getTask,
	createTask,
	createOwnTask,
	updateTask,
	cancelTask,
	updateProgress,
	toggleChecklistItem,
	submitTask,
	reviewTask,
	getDashboard,
	TEAM_ROLES,
};
