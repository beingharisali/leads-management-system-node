// Creates in-app task notifications. Failures are logged, never thrown: a
// missed notification must not undo the task change that triggered it.
const User = require("../models/User");
const Notification = require("../models/Notification");
const logger = require("../middleware/logger");

// `extra`: other fields to store, e.g. { complaint: id }
const notifyUsers = async (userIds, type, message, taskId, extra = {}) => {
	const recipients = [...new Set((userIds || []).filter(Boolean).map(String))];
	if (recipients.length === 0) return;

	try {
		await Notification.insertMany(recipients.map((recipient) => ({ recipient, type, message, task: taskId, ...extra })));
	} catch (err) {
		logger.error(`Task notification (${type}) failed: ${err.message}`);
	}
};

const notifyAdmins = async (type, message, taskId, extra = {}) => {
	try {
		const admins = await User.find({ role: "admin" }).select("_id").lean();
		await notifyUsers(admins.map((a) => a._id), type, message, taskId, extra);
	} catch (err) {
		logger.error(`Task notification (${type}) failed: ${err.message}`);
	}
};

module.exports = { notifyUsers, notifyAdmins };
