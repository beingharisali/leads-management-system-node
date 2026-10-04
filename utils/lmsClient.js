// Talks to the Ideoversity LMS backend (server-to-server, API key auth).
//   LMS_API_URL  e.g. http://localhost:5000/api/v1
//   LMS_API_KEY  must equal LEADS_INTAKE_API_KEY in the LMS backend's .env
const Admission = require("../models/Admission");
const { photoUrl } = require("./cloudinary");
const logger = require("../middleware/logger");

const REQUEST_TIMEOUT_MS = 10 * 1000;
const MAX_SYNC_ATTEMPTS = 10;
const RETRY_INTERVAL_MS = 5 * 60 * 1000;

const lmsUrl = (path) => `${(process.env.LMS_API_URL || "").replace(/\/$/, "")}${path}`;

const isConfigured = () => Boolean(process.env.LMS_API_URL && process.env.LMS_API_KEY);

const lmsRequest = async (path, options = {}) => {
	if (!isConfigured()) throw new Error("LMS_API_URL / LMS_API_KEY are not set");

	const res = await fetch(lmsUrl(path), {
		...options,
		headers: {
			"Content-Type": "application/json",
			"x-api-key": process.env.LMS_API_KEY,
			...(options.headers || {}),
		},
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(body.message || body.msg || `LMS responded with ${res.status}`);
	}
	return body;
};

/* ===================== ADMISSIONS ===================== */

const toLmsPayload = (admission, csr) => ({
	sourceId: String(admission._id),
	receiptId: admission.receiptId,
	fullName: admission.fullName,
	phone: admission.phone,
	course: admission.course,
	// Signed Cloudinary links; the photos themselves aren't public
	idCardUrl: photoUrl(admission.idCardPhoto),
	selfieUrl: photoUrl(admission.selfiePhoto),
	// Missing on submissions made with the earlier sample form
	consent: admission.consent?.termsHash
		? {
			acceptedAt: admission.consent.acceptedAt,
			termsVersion: admission.consent.termsVersion,
			termsHash: admission.consent.termsHash,
			snapshot: admission.consent.snapshot,
		}
		: null,
	payment: {
		status: admission.payment?.status || "pending",
		amount: admission.payment?.amount ?? null,
		paidAt: admission.payment?.paidAt || null,
		screenshotUrl: photoUrl(admission.payment?.screenshotPhoto),
	},
	leadId: admission.lead ? String(admission.lead) : "",
	submittedAt: admission.createdAt,
	csr: csr
		? {
			id: String(csr._id),
			name: csr.name,
			email: csr.email,
			phone: csr.officialPhone || csr.personalPhone || "",
		}
		: {},
});

// Sends one admission to the LMS and records the outcome. Never throws.
const forwardAdmission = async (admissionId) => {
	const admission = await Admission.findById(admissionId).populate("csr", "name email officialPhone personalPhone");
	if (!admission || admission.sync.status === "synced") return;

	try {
		const body = await lmsRequest("/admissions/intake", {
			method: "POST",
			body: JSON.stringify(toLmsPayload(admission, admission.csr)),
		});
		await Admission.updateOne(
			{ _id: admission._id },
			{
				$set: {
					"sync.status": "synced",
					"sync.syncedAt": new Date(),
					"sync.lastAttemptAt": new Date(),
					"sync.lastError": "",
					"sync.lmsId": body?.data?._id ? String(body.data._id) : "",
				},
				$inc: { "sync.attempts": 1 },
			}
		);
	} catch (err) {
		logger.error(`Forwarding admission ${admission._id} to LMS failed: ${err.message}`);
		await Admission.updateOne(
			{ _id: admission._id },
			{
				$set: {
					"sync.status": "failed",
					"sync.lastAttemptAt": new Date(),
					"sync.lastError": err.message,
				},
				$inc: { "sync.attempts": 1 },
			}
		).catch(() => { });
	}
};

// Resends admissions the LMS hasn't received yet (it was down, key wrong...).
const retryUnsyncedAdmissions = async () => {
	if (!isConfigured()) return;
	const pending = await Admission.find({
		"sync.status": { $in: ["pending", "failed"] },
		"sync.attempts": { $lt: MAX_SYNC_ATTEMPTS },
	})
		.select("_id")
		.sort({ createdAt: 1 })
		.limit(25)
		.lean();

	for (const { _id } of pending) {
		await forwardAdmission(_id);
	}
};

const startAdmissionSyncLoop = () => {
	if (!isConfigured()) {
		logger.warn("LMS_API_URL / LMS_API_KEY not set: admissions will be saved but not sent to the LMS.");
	}
	const run = () => retryUnsyncedAdmissions().catch((err) => logger.error(`Admission retry loop: ${err.message}`));
	setTimeout(run, 30 * 1000);
	setInterval(run, RETRY_INTERVAL_MS).unref();
};

module.exports = {
	forwardAdmission,
	retryUnsyncedAdmissions,
	startAdmissionSyncLoop,
};
