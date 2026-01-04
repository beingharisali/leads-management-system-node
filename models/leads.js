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
		},
		assignedTo: {
			type: mongoose.Schema.Types.ObjectId, // ✅ ObjectId type
			ref: "User",                          // ✅ Reference to User (CSR)
			required: true
		},
		status: {
			type: String,
			enum: ["new", "contacted", "converted"],
			default: "new",
		},
	},
	{ timestamps: true }
);

const leadsModel = mongoose.model("Leads", leadSchema);
module.exports = leadsModel;
