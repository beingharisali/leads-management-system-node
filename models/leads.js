const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Enter the name of lead"],
			minlength: 3,
		},
		phone: {
			type: String,
			required: true,
			minlength: 11,
		},
		course: {
			type: String,
			required: true,
		},
		source: {
			type: String,
			default: "manual", // admin ya CSR source
		},
		assignedTo: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User", // CSR user
			required: false, // Admin can create unassigned lead
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User", // Jo lead create kiya (CSR ya Admin)
			required: true,
		},
		status: {
			type: String,
			enum: ["new", "contacted", "converted"],
			default: "new",
		},
		saleAmount: {
			type: Number, // jab convert to sale ho
			default: 0,
		},
	},
	{ timestamps: true }
);

const Leads = mongoose.model("Leads", leadSchema);
module.exports = Leads;
