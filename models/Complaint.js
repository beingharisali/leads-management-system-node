const mongoose = require("mongoose");

// A complaint a team member (staff / CSR) sends to the admin, optionally
// naming another team member. Only the complainant and the admin side (the
// admin, plus staff with the "complaints" permission) ever see it; the
// person it is about is never shown it or told about it.
const COMPLAINT_CATEGORIES = ["behaviour", "work", "attendance", "harassment", "other"];
const MAX_COMPLAINT_PHOTOS = 3;

const photoSchema = new mongoose.Schema(
	{
		publicId: { type: String, required: true },
		name: { type: String, required: true },
		size: { type: Number },
	},
	{ _id: true }
);

const complaintSchema = new mongoose.Schema(
	{
		filedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		// Names kept on the complaint so it still reads correctly after an
		// account is deleted
		filedByName: { type: String, required: true },
		filedByRole: { type: String, enum: ["csr", "staff"], required: true },
		against: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		againstName: { type: String, default: "" },
		againstRole: { type: String, enum: ["csr", "staff", ""], default: "" },

		subject: { type: String, required: [true, "Please add a subject"], trim: true, maxlength: 150 },
		category: { type: String, enum: COMPLAINT_CATEGORIES, required: true },
		description: { type: String, required: [true, "Please describe the complaint"], trim: true, maxlength: 5000 },
		photos: [photoSchema],

		// One reply from the admin side, which the complainant sees (editable)
		reply: { type: String, trim: true, maxlength: 4000, default: "" },
		repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		repliedByName: { type: String, default: "" },
		repliedAt: { type: Date },

		// Admin side only - never sent to the complainant
		adminNote: { type: String, trim: true, maxlength: 4000, default: "" },
	},
	{ timestamps: true }
);

complaintSchema.index({ filedBy: 1, createdAt: -1 });
complaintSchema.index({ against: 1 });
complaintSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Complaint || mongoose.model("Complaint", complaintSchema);
module.exports.COMPLAINT_CATEGORIES = COMPLAINT_CATEGORIES;
module.exports.MAX_COMPLAINT_PHOTOS = MAX_COMPLAINT_PHOTOS;
