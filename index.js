require("dotenv").config();
require("express-async-errors");

const express = require("express");
const app = express();
const cors = require("cors");
const helmet = require("helmet");
const xss = require("xss-clean");

const connectDB = require("./db/connect");

// routers
const authRouter = require("./routes/auth");
const leadRoutes = require("./routes/leads");
const saleRoutes = require("./routes/saleRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const setupAdminRouter = require("./routes/setupAdmin");

// middlewares
const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");
const standardResponse = require("./middleware/standardResponse");
const requestLogger = require("./middleware/requestLogger");

// =======================
// 🔥 SECURITY & CORS
// =======================
// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet());
app.use(xss());

app.use(
	cors({
		origin: process.env.FRONTEND_URL || "http://localhost:3000",
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})
);

// =======================
// Global Middlewares
// =======================
app.use(express.json());
app.use(requestLogger);
app.use(standardResponse);

// =======================
// Routes
// =======================
// API versioning base path: /api/v1
app.use("/api/v1/setup", setupAdminRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/lead", leadRoutes);
app.use("/api/v1/sale", saleRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/reports", reportRoutes);

// Health Check Route (Just to check if server is alive)
app.get("/health", (req, res) => res.status(200).send("Server is healthy"));

// =======================
// Error Handling
// =======================
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// =======================
// Start Server
// =======================
const port = process.env.PORT || 5000;

const start = async () => {
	try {
		await connectDB(process.env.MONGO_URI);
		console.log("🚀 Database Connected Successfully");
		app.listen(port, () =>
			console.log(`✨ Server is blazing on port ${port}`)
		);
	} catch (error) {
		console.error("❌ Database Connection Failed:", error.message);
		process.exit(1); // Exit process with failure
	}
};

start();