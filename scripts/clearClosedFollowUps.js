// One-time cleanup: clears followUpDate on leads that are already closed.
//
// Wrong Number only became a closed status later, so leads marked Wrong
// Number before that still carry a follow-up date and keep showing up in
// the date-based "due" views. Paid/Not Interested are included too in case
// any older records slipped through the same way.
//
// Usage (from the server folder):
//   node scripts/clearClosedFollowUps.js --dry-run   # only report counts
//   node scripts/clearClosedFollowUps.js             # apply the update
require("dotenv").config();
const mongoose = require("mongoose");
const Lead = require("../models/leads.js");
const { CLOSED_STATUSES } = require("../models/leads.js");

const dryRun = process.argv.includes("--dry-run");

const run = async () => {
	if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set in .env");
	await mongoose.connect(process.env.MONGO_URI);

	// Case-insensitive so legacy records saved as e.g. "Wrong Number" match.
	const filter = {
		status: { $in: CLOSED_STATUSES.map((s) => new RegExp(`^\\s*${s}\\s*$`, "i")) },
		followUpDate: { $ne: null },
	};

	const breakdown = await Lead.aggregate([
		{ $match: filter },
		{ $group: { _id: { $toLower: "$status" }, count: { $sum: 1 } } },
	]);
	const total = breakdown.reduce((sum, b) => sum + b.count, 0);

	console.log(`Closed leads with a follow-up date: ${total}`);
	breakdown.forEach((b) => console.log(`  ${b._id}: ${b.count}`));

	if (dryRun || total === 0) {
		console.log(dryRun ? "Dry run - nothing changed." : "Nothing to clear.");
		return;
	}

	const result = await Lead.updateMany(filter, { $set: { followUpDate: null } });
	console.log(`Cleared followUpDate on ${result.modifiedCount} lead(s).`);
};

run()
	.catch((err) => {
		console.error("Cleanup failed:", err.message);
		process.exitCode = 1;
	})
	.finally(() => mongoose.disconnect());
