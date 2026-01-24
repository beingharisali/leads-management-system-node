const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");
const jwt = require("jsonwebtoken");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, UnauthenticatedError, NotFoundError } = require("../errors");
const mongoose = require("mongoose");

// ================= JWT HELPER =================
const createJWT = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_LIFETIME || "1d",
    }
  );
};

// ================= FIRST ADMIN SIGNUP =================
const firstAdminSignup = asyncWrapper(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw new BadRequestError("Please provide name, email and password");
  }
  const adminExists = await User.findOne({ role: "admin" });
  if (adminExists) {
    throw new BadRequestError("Admin already exists. Please login.");
  }
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: "admin",
    status: "active",
  });
  const token = createJWT(user);
  res.status(StatusCodes.CREATED).json({
    success: true,
    token,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, status: "active" },
  });
});

// ================= REGISTER (ADMIN ONLY) =================
const register = asyncWrapper(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new UnauthenticatedError("Only admin can create users");
  }
  const { name, email, password, role = "csr" } = req.body;
  if (!name || !email || !password) {
    throw new BadRequestError("Please provide all values");
  }
  const emailExists = await User.findOne({ email: email.toLowerCase() });
  if (emailExists) {
    throw new BadRequestError("Email already in use");
  }
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: role.toLowerCase(),
    status: "active",
  });
  res.status(StatusCodes.CREATED).json({
    success: true,
    msg: "User created successfully",
    user: { _id: user._id, name: user.name, status: user.status }
  });
});

// ================= LOGIN =================
const login = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new BadRequestError("Please provide email and password");
  }
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  // Strict Block for deactivated CSRs
  if (user.role === "csr" && user.status === "inactive") {
    throw new UnauthenticatedError("Your account has been deactivated. Please contact Admin.");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new UnauthenticatedError("Invalid Credentials");
  }
  const token = createJWT(user);
  res.status(StatusCodes.OK).json({
    success: true,
    token,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status || "active" },
  });
});

// ================= UPDATE STATUS (THE ULTIMATE FIX) =================
const updateStatus = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  console.log(`\n--- [SYNC REQUEST RECEIVED] ---`);
  console.log(`Agent ID: ${id}`);
  console.log(`Requested Status: ${status}`);

  // 1. Data Cleaning
  const targetStatus = status?.toLowerCase().trim();
  if (!["active", "inactive"].includes(targetStatus)) {
    console.log(`[!] REJECTED: Invalid Status: ${status}`);
    throw new BadRequestError("Invalid status. Expected 'active' or 'inactive'");
  }

  // 2. Security Check
  if (req.user.role !== "admin") {
    throw new UnauthenticatedError("Access Denied: Admin only.");
  }

  // 3. Smart ID Mapping (Handles MongoDB ID or Custom CSR ID)
  const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
  const searchCriteria = {
    $or: [
      ...(isValidObjectId ? [{ _id: id }] : []),
      { csrId: id }
    ],
    role: { $ne: "admin" } // Safety: Never let this API touch an admin
  };

  // 4. Atomic Update
  const user = await User.findOneAndUpdate(
    searchCriteria,
    { $set: { status: targetStatus } },
    { new: true, runValidators: true }
  );

  if (!user) {
    console.log(`[!] FAILED: User not found with ID: ${id}`);
    throw new NotFoundError(`Agent with ID ${id} not found.`);
  }

  console.log(`[✓] SUCCESS: ${user.name} is now: ${user.status}`);
  console.log(`--- [SYNC END] ---\n`);

  res.status(StatusCodes.OK).json({
    success: true,
    msg: `Status successfully updated to ${user.status}`,
    user: { _id: user._id, csrId: user.csrId, status: user.status },
  });
});

// ================= UPDATE PROFILE =================
const updateUser = asyncWrapper(async (req, res) => {
  const { name, email, password } = req.body;
  const user = await User.findById(req.user.userId);
  if (!user) throw new UnauthenticatedError("User not found");

  if (email && email.toLowerCase() !== user.email) {
    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) throw new BadRequestError("Email already in use");
    user.email = email.toLowerCase();
  }
  if (name) user.name = name;
  if (password) user.password = password;

  await user.save();
  res.status(StatusCodes.OK).json({
    success: true,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status || "active" },
  });
});

module.exports = {
  firstAdminSignup,
  register,
  login,
  updateUser,
  updateStatus
};