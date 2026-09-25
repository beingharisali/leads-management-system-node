const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const { dayKey } = require("../models/Activity");
const asyncWrapper = require("../middleware/async");
const { BadRequestError } = require("../errors");

// The CSR portal pings every 30s while visible. A gap longer than this
// means the window was hidden/closed (or the machine slept), so that gap
// is not counted as active time.
const MAX_GAP_SECONDS = 90;

// A CSR counts as "online" if their window is on screen and pinged within
// this window (covers a closed window whose final "leave" ping was lost).
const ONLINE_WINDOW_SECONDS = 90;

// Is the CSR on their portal right now, judging by their latest record?
const isOnlineRecord = (record, now) =>
	!!record?.lastSeenAt &&
	record.isActive !== false &&
	(now - record.lastSeenAt) / 1000 <= ONLINE_WINDOW_SECONDS;

// ===============================
// CSR: heartbeat from the portal window. body.kind:
//   "resume" - window just became visible (or page loaded): start a new
//              segment without crediting the time before it
//   "tick"   - still on screen (every 30s): credit the time since last ping
//   "leave"  - window minimised/closed: credit up to now, then stop the clock
// ===============================
const heartbeat = asyncWrapper(async (req, res) => {
	const userId = req.user.userId;
	const now = new Date();
	const day = dayKey(now);
	const kind = ["resume", "tick", "leave"].includes(req.body?.kind)
		? req.body.kind
		: (req.body?.resume === true ? "resume" : "tick");

	const existing = await Activity.findOne({ user: userId, day }).select("lastSeenAt isActive");

	// Only time spent while the window was on screen counts: nothing is
	// credited across a "leave" -> "resume" gap, or a gap too long to be
	// real on-screen time (machine slept, window closed without a ping).
	let credit = 0;
	if (kind !== "resume" && existing?.lastSeenAt && existing.isActive !== false) {
		const gap = (now - existing.lastSeenAt) / 1000;
		if (gap > 0 && gap <= MAX_GAP_SECONDS) credit = Math.round(gap);
	}

	// A duplicate "leave" (e.g. pagehide right after visibilitychange) must
	// not move lastSeenAt forward while the CSR is already away.
	if (kind === "leave" && existing?.isActive === false) {
		return res.status(200).json({ success: true });
	}

	await Activity.updateOne(
		{ user: userId, day },
		{
			$inc: { activeSeconds: credit },
			$set: { lastSeenAt: now, isActive: kind !== "leave" },
			$min: { firstSeenAt: now },
		},
		{ upsert: true }
	);

	res.status(200).json({ success: true });
});

// Called from the login controller so the admin can see when the CSR
// signed in today. Never blocks or fails the login itself.
const recordLogin = async (userId) => {
	try {
		const now = new Date();
		await Activity.updateOne(
			{ user: userId, day: dayKey(now) },
			{ $set: { lastLoginAt: now } },
			{ upsert: true }
		);
	} catch (err) {
		console.error("Failed to record CSR login time:", err.message);
	}
};

// ===============================
// Admin: a CSR's portal time - today plus the last N days
// ===============================
const getCsrActivity = asyncWrapper(async (req, res) => {
	const { csrId } = req.params;
	if (!mongoose.Types.ObjectId.isValid(csrId)) throw new BadRequestError("Invalid CSR ID");

	const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 31);
	const now = new Date();

	const dayKeys = [];
	for (let i = 0; i < days; i++) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		dayKeys.push(dayKey(d));
	}

	const records = await Activity.find({ user: csrId, day: { $in: dayKeys } }).lean();
	const byDay = Object.fromEntries(records.map(r => [r.day, r]));
	const today = byDay[dayKeys[0]];

	// Latest ping across any day, for "last seen" even if not active today
	const lastRecord = await Activity.findOne({ user: csrId, lastSeenAt: { $ne: null } })
		.sort({ lastSeenAt: -1 })
		.select("lastSeenAt isActive")
		.lean();
	const lastSeenAt = lastRecord?.lastSeenAt || null;
	const isOnline = isOnlineRecord(lastRecord, now);

	res.status(200).json({
		success: true,
		data: {
			serverTime: now,
			isOnline,
			lastSeenAt,
			onlineWindowSeconds: ONLINE_WINDOW_SECONDS,
			today: {
				day: dayKeys[0],
				activeSeconds: today?.activeSeconds || 0,
				firstSeenAt: today?.firstSeenAt || null,
				lastLoginAt: today?.lastLoginAt || null,
			},
			history: dayKeys.map(day => ({ day, activeSeconds: byDay[day]?.activeSeconds || 0 })),
		},
	});
});

// ===============================
// Admin: online status + today's portal time for every CSR at once
// (drives the presence line in the admin sidebar)
// ===============================
const getAllCsrPresence = asyncWrapper(async (req, res) => {
	const now = new Date();

	const [latest, todayRecords] = await Promise.all([
		// Each CSR's most recent ping, whatever day it was on
		Activity.aggregate([
			{ $match: { lastSeenAt: { $ne: null } } },
			{ $sort: { lastSeenAt: -1 } },
			{ $group: { _id: "$user", lastSeenAt: { $first: "$lastSeenAt" }, isActive: { $first: "$isActive" } } },
		]),
		Activity.find({ day: dayKey(now) }).select("user activeSeconds").lean(),
	]);

	const todayByUser = Object.fromEntries(todayRecords.map(r => [String(r.user), r.activeSeconds || 0]));

	res.status(200).json({
		success: true,
		data: {
			serverTime: now,
			presence: latest.map(r => ({
				csrId: String(r._id),
				isOnline: isOnlineRecord(r, now),
				lastSeenAt: r.lastSeenAt,
				todaySeconds: todayByUser[String(r._id)] || 0,
			})),
		},
	});
});

module.exports = { heartbeat, recordLogin, getCsrActivity, getAllCsrPresence };
