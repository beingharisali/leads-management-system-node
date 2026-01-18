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
			type: mongoose.Schema.Types.ObjectId,
			ref: "User", // CSR user
			required: true, // ✅ ensure every lead has assigned CSR
		},
		status: {
			type: String,
			enum: ["new", "contacted", "converted"],
			default: "new",
		},
	},
	{ timestamps: true }
);

const Leads = mongoose.model("Leads", leadSchema);
module.exports = Leads;
