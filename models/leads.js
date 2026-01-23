const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Enter the name of lead"],
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
			required: true,
		},
		status: {
			type: String,
			// MAZAY KI BAAT: 'sale' status yahan missing tha, isliye converted leads count nahi ho rahi thi
			enum: {
				values: ["new", "contacted", "interested", "converted", "sale", "rejected"],
				message: "{VALUE} is not a valid status"
			},
			default: "new",
		},
		saleAmount: {
			type: Number,
			default: 0,
			// Validation taake minus mein amount na jaye
			min: [0, "Sale amount cannot be negative"]
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
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ createdAt: -1 });

/* ===================== VIRTUALS ===================== */
leadSchema.virtual("saleDetails", {
	ref: "Sale",
	localField: "_id",
	foreignField: "lead",
	justOne: true,
});

// Pre-save hook taake data clean rahe
leadSchema.pre('save', function (next) {
	if (this.status === 'sale' && this.saleAmount <= 0) {
		// Warning: Sale status hai magar amount 0 hai
	}
	next();
});

const Leads = mongoose.model("Leads", leadSchema);
module.exports = Leads;