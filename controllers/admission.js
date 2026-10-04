const crypto = require("crypto");
const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, CustomAPIError, NotFoundError, UnauthenticatedError } = require("../errors");
const User = require("../models/User");
const Lead = require("../models/leads");
const Admission = require("../models/Admission");
const Sale = require("../models/Sale");
const { startOfDay } = require("../models/leads");
const { forwardAdmission } = require("../utils/lmsClient");
const cloudinary = require("../utils/cloudinary");
const { isImageBuffer } = require("../middleware/admissionUpload");
const { COURSE_CATALOG, OUTLINE_CHECKED_ON, TERMS } = require("../config/admissionForm");
const logger = require("../middleware/logger");

const clean = (value, max = 200) => (value === undefined || value === null ? "" : String(value).trim().slice(0, max));

// "Ali Khan" -> "ali-k7f2"
const generateAdmissionCode = async (name) => {
	const slug = clean(name).toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "").slice(0, 12) || "csr";
	for (let i = 0; i < 5; i++) {
		const code = `${slug}-${crypto.randomBytes(3).toString("hex").slice(0, 4)}`;
		if (!(await User.exists({ admissionCode: code }))) return code;
	}
	return `${slug}-${crypto.randomBytes(6).toString("hex")}`;
};

const findActiveCsrByCode = async (code) => {
	const csr = await User.findOne({ admissionCode: clean(code, 60).toLowerCase(), role: "csr" })
		.select("name email status officialPhone personalPhone");
	if (!csr || csr.status === "inactive") {
		throw new NotFoundError("This admission form link is not valid or is no longer active.");
	}
	return csr;
};

// Everything the student sees and agrees to for one course. Saved with the
// admission and hashed, so the record proves exactly what was accepted.
const buildSnapshot = (course) => ({
	version: TERMS.version,
	checkboxText: TERMS.checkboxText,
	terms: TERMS.terms,
	identityNotice: TERMS.identityNotice,
	admission: {
		courseId: course.id,
		course: course.name,
		courseUrl: course.url,
		outline: course.outline.map((line) => `• ${line}`).join("\n"),
		outlineCheckedOn: OUTLINE_CHECKED_ON,
		schedule: TERMS.schedule,
		totalFeePKR: TERMS.totalFeePKR,
		complaintContact: TERMS.complaintContact,
		beforeStartRefundTerms: TERMS.beforeStartRefundTerms,
		additionalTerms: TERMS.additionalTerms,
	},
});

const hashSnapshot = (snapshot) => crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

// "IDV-20261004-7F3A9C"
const generateReceiptId = () => {
	const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }).replace(/-/g, "");
	return `IDV-${day}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
};

const toReceipt = (admission) => ({
	receiptId: admission.receiptId,
	reference: String(admission._id),
	fullName: admission.fullName,
	acceptedAt: admission.consent.acceptedAt,
	termsHash: admission.consent.termsHash,
	snapshot: admission.consent.snapshot,
});

/* ===================== PUBLIC (no login) ===================== */

// What the public form page needs: who shared it, the courses and the terms.
const getPublicForm = asyncWrapper(async (req, res) => {
	const csr = await findActiveCsrByCode(req.params.code);

	res.status(StatusCodes.OK).json({
		success: true,
		data: {
			csrName: csr.name,
			courses: COURSE_CATALOG,
			outlineCheckedOn: OUTLINE_CHECKED_ON,
			terms: TERMS,
		},
	});
});

// multipart/form-data: fields + idCard and selfie photos (middleware/admissionUpload.js)
const submitPublicForm = asyncWrapper(async (req, res) => {
	const body = req.body || {};

	// Honeypot: a hidden field real visitors never see. Bots that fill it get
	// a normal-looking response and nothing is saved.
	if (clean(body.website)) {
		return res.status(StatusCodes.CREATED).json({ success: true, msg: "Your admission has been submitted." });
	}

	const csr = await findActiveCsrByCode(req.params.code);

	const data = {
		fullName: clean(body.fullName, 80),
		phone: clean(body.phone, 20).replace(/[^\d+]/g, ""),
	};
	const course = COURSE_CATALOG.find((c) => c.id === clean(body.courseId, 100));
	const idCard = req.files?.idCard?.[0];
	const selfie = req.files?.selfie?.[0];

	if (clean(body.termsVersion, 50) !== TERMS.version) {
		throw new BadRequestError("The admission terms have been updated. Please refresh the page and review them again.");
	}

	const errors = [];
	if (data.fullName.length < 2) errors.push("Please enter your full name.");
	if (data.phone.replace(/\D/g, "").length < 10) errors.push("Please enter a valid phone number (at least 10 digits).");
	if (!course) errors.push("Please choose a course.");
	if (!idCard || !isImageBuffer(idCard.buffer)) errors.push("Please upload a photo of your ID card.");
	if (!selfie || !isImageBuffer(selfie.buffer)) errors.push("Please take a selfie.");
	if (body.accepted !== "true") errors.push("Please tick the terms checkbox.");
	if (errors.length) throw new BadRequestError(errors.join(" "));

	if (!cloudinary.isConfigured()) {
		logger.error("Admission photo upload failed: CLOUDINARY_* env vars are not set");
		throw new CustomAPIError("Photo upload is not available right now. Please try again later.", StatusCodes.SERVICE_UNAVAILABLE);
	}

	const admissionId = new mongoose.Types.ObjectId();
	const snapshot = buildSnapshot(course);

	const uploads = await Promise.allSettled([
		cloudinary.uploadAdmissionPhoto(idCard.buffer, `${admissionId}-id-card`),
		cloudinary.uploadAdmissionPhoto(selfie.buffer, `${admissionId}-selfie`),
	]);
	const photos = uploads.map((u) => (u.status === "fulfilled" ? u.value : null));
	const failed = uploads.find((u) => u.status === "rejected");
	if (failed) {
		logger.error(`Admission photo upload failed: ${failed.reason?.message || failed.reason}`);
		await cloudinary.deleteAdmissionPhotos(photos);
		throw new CustomAPIError("Your photos could not be uploaded. Please try again.", StatusCodes.BAD_GATEWAY);
	}

	let admission;
	try {
		admission = await Admission.create({
			_id: admissionId,
			receiptId: generateReceiptId(),
			...data,
			courseId: course.id,
			course: course.name,
			idCardPhoto: photos[0],
			selfiePhoto: photos[1],
			selfieMethod: "camera",
			consent: {
				accepted: true,
				acceptedAt: new Date(),
				termsVersion: TERMS.version,
				termsHash: hashSnapshot(snapshot),
				snapshot,
			},
			csr: csr._id,
			ip: req.ip || "",
			userAgent: clean(req.get("user-agent"), 300),
		});
	} catch (err) {
		await cloudinary.deleteAdmissionPhotos(photos);
		throw err;
	}

	// The submission also shows up in the CSR's leads. Never blocks the form.
	const lead = await attachLead({ ...data, course: course.name }, csr);
	if (lead) await Admission.updateOne({ _id: admission._id }, { $set: { lead: lead._id } });

	// Hand off to the LMS in the background; the student doesn't wait for it.
	// Failed sends are retried by the loop in utils/lmsClient.js.
	forwardAdmission(admission._id).catch((err) => logger.error(`forwardAdmission: ${err.message}`));

	res.status(StatusCodes.CREATED).json({
		success: true,
		msg: "Your admission has been submitted.",
		data: {
			receipt: toReceipt(admission),
			// Student sends the payment screenshot to this number on WhatsApp
			csr: { name: csr.name, whatsapp: csr.officialPhone || "" },
		},
	});
});

// The submission also shows up in the CSR's lead list: reuse their lead with
// the same phone, otherwise create an Interested lead. Never blocks the form.
const attachLead = async (data, csr) => {
	try {
		const existing = await Lead.findOne({ phone: data.phone, assignedTo: csr._id }).sort({ createdAt: -1 });
		if (existing) return existing;

		return await Lead.create({
			name: data.fullName,
			phone: data.phone,
			course: data.course,
			city: data.city || "Unknown",
			source: "admission form",
			assignedTo: csr._id,
			createdBy: csr._id,
			status: "interested",
			followUpDate: startOfDay(new Date()),
			remarks: "Submitted the online admission form",
		});
	} catch (err) {
		logger.error(`Could not attach a lead to admission (${data.phone}): ${err.message}`);
		return null;
	}
};

/* ===================== CSR ===================== */

// The logged-in CSR's own form link code (created on first use).
const getMyAdmissionLink = asyncWrapper(async (req, res) => {
	const user = await User.findById(req.user.userId).select("name admissionCode role");
	if (!user) throw new UnauthenticatedError("Your account no longer exists. Please log in again.");

	if (!user.admissionCode) {
		user.admissionCode = await generateAdmissionCode(user.name);
		await user.save();
	}

	res.status(StatusCodes.OK).json({ success: true, data: { code: user.admissionCode } });
});

// What a CSR may see of an admission
const CSR_ADMISSION_FIELDS = "-ip -userAgent -consent.snapshot";

// Forms submitted through the logged-in CSR's link, newest first.
const getMyAdmissions = asyncWrapper(async (req, res) => {
	const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
	const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
	const filter = { csr: req.user.userId };

	const [admissions, total] = await Promise.all([
		Admission.find(filter)
			.select(CSR_ADMISSION_FIELDS)
			.sort({ createdAt: -1 })
			.skip((page - 1) * limit)
			.limit(limit)
			.lean(),
		Admission.countDocuments(filter),
	]);

	res.status(StatusCodes.OK).json({
		success: true,
		data: admissions.map(toCsrAdmission),
		page,
		total,
		totalPages: Math.max(Math.ceil(total / limit), 1),
	});
});

// Photo ids swapped for signed links. Older submissions have no payment block.
const toCsrAdmission = ({ idCardPhoto, selfiePhoto, payment, ...a }) => {
	const { screenshotPhoto, ...paymentInfo } = payment || {};
	return {
		...a,
		idCardUrl: cloudinary.photoUrl(idCardPhoto),
		selfieUrl: cloudinary.photoUrl(selfiePhoto),
		payment: {
			status: "pending",
			...paymentInfo,
			screenshotUrl: cloudinary.photoUrl(screenshotPhoto),
		},
	};
};

// Admissions the CSR hasn't been alerted about yet (polled by the portal).
const getUnseenAdmissions = asyncWrapper(async (req, res) => {
	const admissions = await Admission.find({ csr: req.user.userId, csrSeen: false })
		.select("fullName phone course createdAt")
		.sort({ createdAt: -1 })
		.limit(20)
		.lean();

	res.status(StatusCodes.OK).json({ success: true, data: admissions });
});

const markAdmissionsSeen = asyncWrapper(async (req, res) => {
	await Admission.updateMany({ csr: req.user.userId, csrSeen: false }, { $set: { csrSeen: true } });
	res.status(StatusCodes.OK).json({ success: true });
});

// CSR received the payment screenshot on WhatsApp: upload it, mark the
// admission paid, record the Sale and close the lead as Paid - the same
// result as converting a lead to a sale from the dashboard.
// multipart/form-data: amount + screenshot (middleware/admissionUpload.js)
const markAdmissionPaid = asyncWrapper(async (req, res) => {
	const csrId = req.user.userId;
	const admission = await Admission.findOne({ _id: req.params.id, csr: csrId });
	if (!admission) throw new NotFoundError("Admission not found.");
	if (admission.payment?.status === "paid") throw new BadRequestError("This admission is already marked as paid.");

	const amount = Number(req.body?.amount);
	const errors = [];
	if (!Number.isFinite(amount) || amount <= 0) errors.push("Please enter the amount the student paid.");
	if (!req.file || !isImageBuffer(req.file.buffer)) errors.push("Please upload the payment screenshot.");
	if (errors.length) throw new BadRequestError(errors.join(" "));

	if (!cloudinary.isConfigured()) {
		logger.error("Payment screenshot upload failed: CLOUDINARY_* env vars are not set");
		throw new CustomAPIError("Screenshot upload is not available right now. Please try again later.", StatusCodes.SERVICE_UNAVAILABLE);
	}

	let screenshot;
	try {
		screenshot = await cloudinary.uploadAdmissionPhoto(req.file.buffer, `${admission._id}-payment-${Date.now()}`);
	} catch (err) {
		logger.error(`Payment screenshot upload failed: ${err.message}`);
		throw new CustomAPIError("The screenshot could not be uploaded. Please try again.", StatusCodes.BAD_GATEWAY);
	}

	// Claim the admission atomically, so a double click can't record two sales
	const claimed = await Admission.findOneAndUpdate(
		{ _id: admission._id, csr: csrId, "payment.status": { $ne: "paid" } },
		{
			$set: {
				"payment.status": "paid",
				"payment.amount": amount,
				"payment.screenshotPhoto": screenshot,
				"payment.paidAt": new Date(),
				"payment.markedBy": csrId,
			},
		},
		{ returnDocument: "after" }
	);
	if (!claimed) {
		await cloudinary.deleteAdmissionPhotos([screenshot]);
		throw new BadRequestError("This admission is already marked as paid.");
	}

	let sale = null;
	try {
		// The lead made at submission time, or a new one if it was deleted
		let lead = admission.lead ? await Lead.findById(admission.lead) : null;
		if (!lead) {
			lead = await attachLead({ fullName: admission.fullName, phone: admission.phone, course: admission.course }, { _id: csrId });
			if (!lead) throw new Error("could not create a lead for this admission");
		}

		sale = await Sale.create({
			lead: lead._id,
			csr: csrId,
			amount,
			course: admission.course,
			remarks: `Admission form registration · receipt ${admission.receiptId}`,
		});

		await Lead.findByIdAndUpdate(lead._id, {
			status: "paid",
			saleAmount: amount,
			convertedAt: Date.now(),
			lastUpdatedBy: csrId,
		});

		claimed.lead = lead._id;
		claimed.payment.sale = sale._id;
		// Re-send to the LMS so the admin sees the payment
		claimed.sync.status = "pending";
		claimed.sync.attempts = 0;
		await claimed.save();
	} catch (err) {
		logger.error(`Marking admission ${admission._id} paid failed: ${err.message}`);
		await Admission.updateOne(
			{ _id: admission._id },
			{ $set: { payment: { status: "pending", amount: null, screenshotPhoto: "", paidAt: null, markedBy: null, sale: null } } }
		);
		if (sale) await Sale.deleteOne({ _id: sale._id }).catch(() => { });
		await cloudinary.deleteAdmissionPhotos([screenshot]);
		throw err;
	}

	forwardAdmission(admission._id).catch((err) => logger.error(`forwardAdmission: ${err.message}`));

	res.status(StatusCodes.OK).json({
		success: true,
		msg: "Payment recorded. The student is now in your closed leads as Paid.",
		data: toCsrAdmission(await Admission.findById(admission._id).select(CSR_ADMISSION_FIELDS).lean()),
	});
});

module.exports = {
	getPublicForm,
	submitPublicForm,
	getMyAdmissionLink,
	getMyAdmissions,
	getUnseenAdmissions,
	markAdmissionsSeen,
	markAdmissionPaid,
};
