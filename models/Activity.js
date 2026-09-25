const mongoose = require("mongoose");

// One document per CSR per day: how long they actually had their portal
// open and visible on screen. The CSR's browser pings while the window is
// visible; the server credits the time between pings (see controllers/activity.js).
const activitySchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		// Server-local calendar day, "YYYY-MM-DD"
		day: {
			type: String,
			required: true,
		},
		activeSeconds: {
			type: Number,
			default: 0,
			min: 0,
		},
		firstSeenAt: { type: Date },
		lastSeenAt: { type: Date },
		// true while the CSR's portal window is on screen; false as soon as
		// they minimise/close it (so the admin's timer stops immediately)
		isActive: { type: Boolean, default: false },
		lastLoginAt: { type: Date },
	},
	{ timestamps: true }
);

activitySchema.index({ user: 1, day: 1 }, { unique: true });

const dayKey = (date = new Date()) => {
	const d = new Date(date);
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
};

const Activity = mongoose.models.Activity || mongoose.model("Activity", activitySchema);
module.exports = Activity;
module.exports.dayKey = dayKey;
