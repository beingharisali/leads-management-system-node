const mongoose = require("mongoose");

// In-app notifications for the task module (admin bell + team member bell).
const notificationSchema = new mongoose.Schema(
	{
		recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		type: {
			type: String,
			enum: ["task_assigned", "task_overdue", "task_submitted", "task_approved", "task_rejected", "task_blocked", "task_cancelled", "task_self_created"],
			required: true,
		},
		message: { type: String, required: true },
		task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
		read: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
// Old notifications clean themselves up after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
