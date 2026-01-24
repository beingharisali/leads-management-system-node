const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Lead name is required"],
			minlength: [2, "Name must be at least 2 characters"],
			trim: true,
		},
		phone: {
			type: String,
			required: [true, "Phone number is required"],
			minlength: [10, "Phone number must be at least 10 digits"],
			trim: true,
		},
		course: {
			type: String,
			required: [true, "Course name is required"],
			trim: true,
		},
		city: {
			type: String,
			trim: true,
			default: "Unknown",
		},
		source: {
			type: String,
			default: "manual",
		},
		assignedTo: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: [true, "A lead must be assigned to a CSR"],
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: [true, "Creator ID is required"],
		},
		status: {
			type: String,
			lowercase: true,
			trim: true,
			enum: {
				// ✅ Added "not pick", "busy", "wrong number" to prevent 500 Errors
				values: [
					"new",
					"contacted",
					"interested",
					"converted",
					"sale",
					"rejected",
					"follow-up",
					"paid",
					"not pick",
					"busy",
					"wrong number"
				],
				message: "{VALUE} is not a supported status"
			},
			default: "new",
		},
		// ✅ Using camelCase to match Frontend API calls
		followUpDate: {
			type: Date,
		},
		remarks: {
			type: String,
			trim: true,
		},
		saleAmount: {
			type: Number,
			default: 0,
			min: [0, "Sale amount cannot be negative"]
		},
		convertedAt: {
			type: Date,
		},
		lastUpdatedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		}
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true }
	}
);

/* ===================== INDEXING ===================== */
// Search speed behtar karne ke liye
leadSchema.index({ name: 'text', phone: 'text' });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ createdAt: -1 });

/* ===================== VIRTUALS ===================== */
leadSchema.virtual("saleDetails", {
	ref: "Sale",
	localField: "_id",
	foreignField: "lead",
	justOne: true,
});

/* ===================== MIDDLEWARE (FIXED) ===================== */

// Save hook (for .create and .save)
leadSchema.pre('save', async function (next) {
	if (this.isModified('status') && (this.status === 'sale' || this.status === 'paid')) {
		this.convertedAt = Date.now();
	}
	next();
});

// Update hook (for findByIdAndUpdate / findOneAndUpdate)
// Ismein 'next' ko hata dein aur normal function use karein
leadSchema.pre('findOneAndUpdate', function () {
	this.set({ updatedAt: Date.now() });
	// Note: Query middleware mein 'next' ki aksar zaroorat nahi hoti agar async na ho
});
// Model Export
const Leads = mongoose.models.Leads || mongoose.model("Leads", leadSchema);
module.exports = Leads;