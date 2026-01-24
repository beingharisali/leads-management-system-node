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

/* ===================== MIDDLEWARE ===================== */

// Save hook (Lead create karte waqt chalta hai)
leadSchema.pre('save', async function () {
	if (this.isModified('status')) {
		const currentStatus = this.status ? this.status.toLowerCase() : '';
		if (currentStatus === 'sale' || currentStatus === 'paid') {
			this.convertedAt = Date.now();
		}
	}
	// Async function mein next() ki zaroorat nahi hoti
});

// Update hook (PATCH request ke liye)
// Humne 'next' hata diya hai aur 'async' add kiya hai taake error na aaye
leadSchema.pre('findOneAndUpdate', async function () {
	const update = this.getUpdate();

	if (!update) return;

	// Check if status is being updated
	const newStatus = update.status || (update.$set && update.$set.status);

	if (newStatus) {
		const normalizedStatus = newStatus.toLowerCase();
		if (normalizedStatus === 'sale' || normalizedStatus === 'paid') {
			// Hum directly query par set kar rahe hain
			this.set({ convertedAt: Date.now() });
		}
	}

	// Updated at hamesha set hoga
	this.set({ updatedAt: Date.now() });
});

// Model Export
const Leads = mongoose.models.Leads || mongoose.model("Leads", leadSchema);
module.exports = Leads;