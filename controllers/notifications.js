const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Notification = require("../models/Notification");
const { NotFoundError } = require("../errors");

// GET /notifications - the signed-in user's latest notifications + unread count
const getMyNotifications = async (req, res) => {
	const [items, unread] = await Promise.all([
		Notification.find({ recipient: req.user.userId }).sort({ createdAt: -1 }).limit(50).lean(),
		Notification.countDocuments({ recipient: req.user.userId, read: false }),
	]);
	res.status(StatusCodes.OK).json({ success: true, data: { items, unread } });
};

// PATCH /notifications/:id/read
const markRead = async (req, res) => {
	if (!mongoose.isValidObjectId(req.params.id)) throw new NotFoundError("Notification not found.");
	const result = await Notification.updateOne({ _id: req.params.id, recipient: req.user.userId }, { $set: { read: true } });
	if (result.matchedCount === 0) throw new NotFoundError("Notification not found.");
	res.status(StatusCodes.OK).json({ success: true });
};

// PATCH /notifications/read-all
const markAllRead = async (req, res) => {
	await Notification.updateMany({ recipient: req.user.userId, read: false }, { $set: { read: true } });
	res.status(StatusCodes.OK).json({ success: true });
};

module.exports = { getMyNotifications, markRead, markAllRead };
