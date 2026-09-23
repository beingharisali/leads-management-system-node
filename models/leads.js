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
					"interested",
					"converted",
					"sale",
					"not interested",
					"paid",
					"not pick",
					"busy",
					"wrong number"
				],
				message: "{VALUE} is not a supported status"
			},
			default: "new",
		},

		statusUpdatedAt: {
			type: Date,
			default: Date.now,
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

/* ===================== FOLLOW-UP SCHEDULING ===================== */
// Statuses that close a lead out: once here, it no longer needs a follow-up
// date and stops showing up in the agent's working views.
const CLOSED_STATUSES = ['paid', 'sale', 'not interested', 'converted', 'wrong number'];

// The only statuses an agent may pin a specific follow-up date on. Any
// other open status (e.g. "new") just gets the automatic scheduling.
const FOLLOW_UP_STATUSES = ['not pick', 'interested', 'busy'];

const startOfDay = (date) => {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
};

const tomorrowStart = () => {
	const d = startOfDay(new Date());
	d.setDate(d.getDate() + 1);
	return d;
};

/* ===================== MIDDLEWARE ===================== */

// Save hook (Lead create karte waqt chalta hai)
leadSchema.pre('save', async function () {
	if (this.isModified('status')) {
		const currentStatus = this.status
			? this.status.toLowerCase()
			: '';

		// Status change ka exact time save karo
		this.statusUpdatedAt = new Date();

		// Sale/Paid hone par conversion time save karo
		if (currentStatus === 'sale' || currentStatus === 'paid') {
			this.convertedAt = new Date();
		}
	}
});

// Update hook (PATCH request ke liye)
leadSchema.pre('findOneAndUpdate', async function () {
	const update = this.getUpdate();

	if (!update) return;

	const setBlock = update.$set || update;
	const hasStatusKey = Object.prototype.hasOwnProperty.call(setBlock, 'status');
	const hasFollowUpKey = Object.prototype.hasOwnProperty.call(setBlock, 'followUpDate');
	const newStatus = setBlock.status;

	if (hasStatusKey && newStatus) {
		const normalizedStatus = newStatus
			.toString()
			.toLowerCase()
			.trim();

		// Har status change ka exact time
		this.set({
			statusUpdatedAt: new Date(),
		});

		// Paid/Sale ka conversion time
		if (
			normalizedStatus === 'sale' ||
			normalizedStatus === 'paid'
		) {
			this.set({
				convertedAt: new Date(),
			});
		}

		// Follow-up scheduling: closed statuses (Paid/Not Interested/Wrong
		// Number) always clear the date - even if the caller sent one. Any
		// other status, unless the caller sent an explicit followUpDate,
		// automatically rolls the lead to tomorrow so it reappears in the
		// CSR's "today" filter next day.
		if (CLOSED_STATUSES.includes(normalizedStatus)) {
			this.set({ followUpDate: null });
		} else if (!hasFollowUpKey) {
			this.set({ followUpDate: tomorrowStart() });
		}
	}

	// updatedAt manually update
	this.set({
		updatedAt: new Date(),
	});
});

// Model Export
const Leads = mongoose.models.Leads || mongoose.model("Leads", leadSchema);
module.exports = Leads;
module.exports.CLOSED_STATUSES = CLOSED_STATUSES;
module.exports.FOLLOW_UP_STATUSES = FOLLOW_UP_STATUSES;
module.exports.startOfDay = startOfDay;