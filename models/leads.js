const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Enter the name of lead"],
			minlength: 3,
			maxlength: 50,
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
		assaignedTo: {
			type: mongoose.Schema.ObjectId,
			required: true,
			ref: "User",
		},
	},
	{ timestamps: true }
);

const leadsModel = mongoose.model("Leads", leadSchema);
module.exports = leadsModel;
