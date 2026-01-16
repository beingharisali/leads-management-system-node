require("dotenv").config();
require("express-async-errors");

const path = require("path");
// extra security packages
const helmet = require("helmet");
const xss = require("xss-clean");

const express = require("express");
const app = express();
const cors = require("cors");

const connectDB = require("./db/connect");

// routers
const authRouter = require("./routes/auth");
const leadRoutes = require("./routes/leads");
const saleRoutes = require("./routes/saleRoutes"); // ✅ Task-20 added
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const setupAdminRouter = require('./routes/setupAdmin');
app.use('/api/v1/setup', setupAdminRouter);



// error handler
const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");
const standardResponse = require("./middleware/standardResponse");
const requestLogger = require("./middleware/requestLogger");


// app.set('trust proxy', 1);
app.use(
	cors({
		origin: "http://localhost:30001", // Allow requests from the frontend
	})
);

// app.use(express.static(path.resolve(__dirname, "./client/build")));
app.use(requestLogger);
app.use(express.json());
app.use(helmet());
app.use(xss());
app.use(standardResponse);


// routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/lead", leadRoutes);
app.use("/api/v1/sale", saleRoutes); // ✅ Task-20 route mounted
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/reports", reportRoutes);



// error handling middlewares
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5000;

const start = async () => {
	try {
		await connectDB(process.env.MONGO_URI);
		app.listen(port, () =>
			console.log(`Server is listening on port ${port}...`)
		);
	} catch (error) {
		console.log(error);
	}
};

start();
