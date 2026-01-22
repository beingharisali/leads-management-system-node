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
			// Note: Excel imports mein aksar numbers format change kar letay hain
			// isliye minlength 10 rakhi hai (Pakistan numbers ke liye)
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
			// Standardizing sources for better analytics
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
			// Added 'interested' and 'rejected' to cover full sales cycle
			enum: {
				values: ["new", "contacted", "interested", "converted", "rejected"],
				message: "{VALUE} is not a valid status"
			},
			default: "new",
		},
		saleAmount: {
			type: Number,
			default: 0,
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
// Search ko fast karne ke liye
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ createdAt: -1 }); // Latest leads pehle dikhane ke liye

/* ===================== VIRTUALS ===================== */
// Agar aap Sale model se reference lena chahen
leadSchema.virtual("saleDetails", {
	ref: "Sale",
	localField: "_id",
	foreignField: "lead",
	justOne: true,
});

const Leads = mongoose.model("Leads", leadSchema);
module.exports = Leads;