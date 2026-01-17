const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const UserSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, "Please provide name"],
		maxlength: 50,
		minlength: 3
	},
	email: {
		type: String,
		required: [true, "Please provide email"],
		unique: true
	},
	password: {
		type: String,
		required: [true, "Please provide password"],
		minlength: 6
	},
	lastName: {
		type: String,
		default: "lastName"
	},
	location: {
		type: String,
		default: "my city"
	},
	role: {
		type: String,
		enum: ["csr", "admin"],
		default: "csr"
	},
});

UserSchema.pre("save", async function () {
	if (!this.isModified("password")) return;
	const salt = await bcrypt.genSalt(10);
	this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.createJWT = function () {
	return jwt.sign({ userId: this._id, name: this.name, role: this.role }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_LIFETIME || "1d",
	});
};

UserSchema.methods.comparePassword = async function (candidatePassword) {
	return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
