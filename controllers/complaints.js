const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { COMPLAINT_CATEGORIES, MAX_COMPLAINT_PHOTOS } = Complaint;
const { BadRequestError, NotFoundError, ForbiddenError } = require("../errors");
const { notifyUsers, notifyAdmins } = require("../utils/taskNotify");
const { isImageBuffer } = require("../middleware/admissionUpload");
const { isConfigured: photosConfigured, uploadComplaintPhoto, complaintPhotoUrl, deleteComplaintPhotos } = require("../utils/complaintFiles");

// Account roles that can file complaints and be named in them
const TEAM_ROLES = ["csr", "staff"];

const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);
const isRealAdmin = (req) => req.user.role === "admin" && !req.user.staffAccess;
// The admin side: the admin, or a staff member given the "complaints" permission
const isReviewer = (req) =>
	req.user.role === "admin" || (req.user.role === "staff" && (req.user.permissions || []).includes("complaints"));

const assertReviewer = (req) => {
	if (!isReviewer(req)) throw new ForbiddenError("You do not have permission to perform this action.");
};

// A staff reviewer never sees complaints about themselves, nor their own
// (those stay in their My Complaints, without the admin note)
const reviewerFilter = (req) =>
	isRealAdmin(req) ? {} : { against: { $ne: req.user.userId }, filedBy: { $ne: req.user.userId } };

const findOr404 = async (id, extraFilter = {}) => {
	if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Complaint not found.");
	const complaint = await Complaint.findOne({ _id: id, ...extraFilter });
	if (!complaint) throw new NotFoundError("Complaint not found.");
	return complaint;
};

const withPhotoUrls = (c) => ({
	...c,
	photos: (c.photos || []).map((p) => ({ _id: p._id, name: p.name, url: complaintPhotoUrl(p) })),
	replied: Boolean(c.reply),
});

// What the complainant sees: everything except the admin note and who replied
const forComplainant = (c) => {
	const { adminNote, repliedBy, repliedByName, ...rest } = c;
	return withPhotoUrls(rest);
};

/* ================= TEAM MEMBER ================= */

// GET /complaints/meta - categories and the photo limit for the form
const getMeta = async (req, res) => {
	res.status(StatusCodes.OK).json({
		success: true,
		data: { categories: COMPLAINT_CATEGORIES, maxPhotos: MAX_COMPLAINT_PHOTOS },
	});
};

// GET /complaints/members - other staff / CSRs, for "complaining about"
const getMembers = async (req, res) => {
	const members = await User.find({ role: { $in: TEAM_ROLES }, _id: { $ne: req.user.userId } })
		.select("name role status")
		.sort({ status: 1, name: 1 })
		.lean();
	res.status(StatusCodes.OK).json({ success: true, data: members });
};

// GET /complaints/mine - the complaints this team member filed
const getMyComplaints = async (req, res) => {
	const items = await Complaint.find({ filedBy: req.user.userId }).sort({ createdAt: -1 }).lean();
	res.status(StatusCodes.OK).json({ success: true, data: items.map(forComplainant) });
};

// POST /complaints (multipart) { subject, category, description, against?, photos[] }
const createComplaint = async (req, res) => {
	const subject = String(req.body?.subject || "").trim();
	const category = String(req.body?.category || "").trim();
	const description = String(req.body?.description || "").trim();
	const againstId = String(req.body?.against || "").trim();
	const files = req.files || [];

	if (!subject) throw new BadRequestError("Please add a subject.");
	if (subject.length > 150) throw new BadRequestError("The subject can be at most 150 characters.");
	if (!COMPLAINT_CATEGORIES.includes(category)) throw new BadRequestError("Please choose a category.");
	if (!description) throw new BadRequestError("Please describe the complaint.");
	if (description.length > 5000) throw new BadRequestError("The description can be at most 5000 characters.");

	const me = await User.findById(req.user.userId).select("name role").lean();
	if (!me || !TEAM_ROLES.includes(me.role)) throw new ForbiddenError("Only team members can file complaints.");

	let against = null;
	if (againstId) {
		if (!mongoose.isValidObjectId(againstId)) throw new BadRequestError("Please choose a valid team member.");
		if (sameId(againstId, me._id)) throw new BadRequestError("You can't file a complaint about yourself.");
		against = await User.findOne({ _id: againstId, role: { $in: TEAM_ROLES } }).select("name role").lean();
		if (!against) throw new BadRequestError("The team member you chose was not found.");
	}

	if (files.length > 0 && !photosConfigured()) {
		throw new BadRequestError("Photo uploads are not set up on the server yet. Please send the complaint without photos.");
	}
	const bad = files.find((f) => !isImageBuffer(f.buffer));
	if (bad) throw new BadRequestError(`"${bad.originalname}" doesn't look like a valid image.`);

	const complaint = new Complaint({
		filedBy: me._id,
		filedByName: me.name,
		filedByRole: me.role,
		against: against?._id,
		againstName: against?.name || "",
		againstRole: against?.role || "",
		subject,
		category,
		description,
	});

	const uploaded = [];
	try {
		for (const file of files) {
			uploaded.push(await uploadComplaintPhoto(file, complaint._id));
		}
	} catch (err) {
		await deleteComplaintPhotos(uploaded);
		throw new BadRequestError("Uploading the photos failed. Please try again.");
	}
	complaint.photos = uploaded;

	try {
		await complaint.save();
	} catch (err) {
		await deleteComplaintPhotos(uploaded);
		throw err;
	}

	await notifyAdmins("complaint_filed", `${me.name} filed a complaint: "${subject}"`, undefined, { complaint: complaint._id });

	res.status(StatusCodes.CREATED).json({ success: true, data: forComplainant(complaint.toObject()) });
};

// DELETE /complaints/mine/:id - the complainant withdraws it, until the admin replies
const deleteMyComplaint = async (req, res) => {
	const complaint = await findOr404(req.params.id, { filedBy: req.user.userId });
	if (complaint.reply) throw new BadRequestError("The admin has already replied, so this complaint can't be deleted.");
	await removeComplaint(complaint);
	res.status(StatusCodes.OK).json({ success: true, msg: "Complaint deleted." });
};

/* ================= ADMIN SIDE ================= */

// GET /complaints?q=&category=&replied=yes|no&against=&page=&limit=
const getComplaints = async (req, res) => {
	assertReviewer(req);
	const filter = { ...reviewerFilter(req) };
	const { q, category, replied, against } = req.query;

	if (category && COMPLAINT_CATEGORIES.includes(category)) filter.category = category;
	if (replied === "yes") filter.reply = { $nin: ["", null] };
	if (replied === "no") filter.reply = { $in: ["", null] };
	if (against && mongoose.isValidObjectId(against)) {
		// Keeps the reviewer's own exclusion: asking for themselves finds nothing
		filter.against = isRealAdmin(req) || !sameId(against, req.user.userId) ? against : null;
	}
	const search = String(q || "").trim();
	if (search) {
		const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
		filter.$or = [{ subject: rx }, { description: rx }, { filedByName: rx }, { againstName: rx }];
	}

	const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
	const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
	const [items, total] = await Promise.all([
		Complaint.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
		Complaint.countDocuments(filter),
	]);

	res.status(StatusCodes.OK).json({
		success: true,
		data: items.map(withPhotoUrls),
		pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
	});
};

// GET /complaints/:id
const getComplaint = async (req, res) => {
	assertReviewer(req);
	const complaint = await findOr404(req.params.id, reviewerFilter(req));
	res.status(StatusCodes.OK).json({ success: true, data: withPhotoUrls(complaint.toObject()) });
};

// PATCH /complaints/:id/reply { reply } - written once, can be edited later
const replyToComplaint = async (req, res) => {
	assertReviewer(req);
	const complaint = await findOr404(req.params.id, reviewerFilter(req));
	const reply = String(req.body?.reply || "").trim();
	if (!reply) throw new BadRequestError("Please write a reply.");
	if (reply.length > 4000) throw new BadRequestError("The reply can be at most 4000 characters.");

	const firstReply = !complaint.reply;
	if (!firstReply && complaint.reply === reply) {
		return res.status(StatusCodes.OK).json({ success: true, data: withPhotoUrls(complaint.toObject()) });
	}

	complaint.reply = reply;
	complaint.repliedBy = req.user.userId;
	complaint.repliedByName = req.user.name || "";
	complaint.repliedAt = new Date();
	await complaint.save();

	const message = firstReply
		? `The admin replied to your complaint "${complaint.subject}"`
		: `The admin updated the reply to your complaint "${complaint.subject}"`;
	await notifyUsers([complaint.filedBy], "complaint_replied", message, undefined, { complaint: complaint._id });

	res.status(StatusCodes.OK).json({ success: true, data: withPhotoUrls(complaint.toObject()) });
};

// PATCH /complaints/:id/note { note } - private to the admin side ("" clears it)
const updateAdminNote = async (req, res) => {
	assertReviewer(req);
	const complaint = await findOr404(req.params.id, reviewerFilter(req));
	const note = String(req.body?.note || "").trim();
	if (note.length > 4000) throw new BadRequestError("The note can be at most 4000 characters.");
	complaint.adminNote = note;
	await complaint.save();
	res.status(StatusCodes.OK).json({ success: true, data: withPhotoUrls(complaint.toObject()) });
};

// DELETE /complaints/:id - the admin side can delete any complaint it can see
const deleteComplaint = async (req, res) => {
	assertReviewer(req);
	const complaint = await findOr404(req.params.id, reviewerFilter(req));
	await removeComplaint(complaint);
	res.status(StatusCodes.OK).json({ success: true, msg: "Complaint deleted." });
};

const removeComplaint = async (complaint) => {
	await Complaint.deleteOne({ _id: complaint._id });
	await Notification.deleteMany({ complaint: complaint._id });
	await deleteComplaintPhotos(complaint.photos);
};

module.exports = {
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
};
