const mongoose = require("mongoose");

const connectDB = () => {
	return mongoose
		.connect(process.env.MONGO_URI)
		.then(() => {
			console.log("Connected to database successfully");
		})
		.catch((err) => {
			console.error("Error occurred while connecting to DB:", err);
		});
};

module.exports = connectDB;
