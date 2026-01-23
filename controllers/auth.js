const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");
const jwt = require("jsonwebtoken");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, UnauthenticatedError, NotFoundError } = require("../errors");

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
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: "active",
    },
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

  await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: role.toLowerCase(),
    status: "active",
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    msg: "User created successfully",
  });
});

// ================= LOGIN (WITH REPAIR LOGIC) =================
const login = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError("Please provide email and password");
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  // ✅ Status Check (Admin bypasses this)
  if (user.role === "csr" && user.status === "inactive") {
    throw new UnauthenticatedError("Your account has been deactivated. Please contact Admin.");
  }

  // ✅ Password Check (Hash + Plain Text Bypass)
  const isHashMatch = await user.comparePassword(password);
  const isPlainMatch = (password === user.password);

  if (!isHashMatch && !isPlainMatch) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  const token = createJWT(user);

  res.status(StatusCodes.OK).json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || "active",
    },
  });
});

// ================= UPDATE STATUS (FIXED FOR FRONTEND) =================
const updateStatus = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validation
  if (!["active", "inactive"].includes(status)) {
    throw new BadRequestError("Invalid status value");
  }

  // Authorization
  if (req.user.role !== "admin") {
    throw new UnauthenticatedError("Only admin can change user status");
  }

  const userToUpdate = await User.findById(id);
  if (!userToUpdate) {
    throw new NotFoundError(`No user found with id: ${id}`);
  }

  // Admin protection
  if (userToUpdate.role === "admin") {
    throw new BadRequestError("Admin status cannot be modified.");
  }

  // Update and Save
  userToUpdate.status = status;
  await userToUpdate.save();

  // ✅ RETURN FULL USER OBJECT
  // Taake frontend bina refresh kiye UI update kar sakay
  res.status(StatusCodes.OK).json({
    success: true,
    msg: `User is now ${status}`,
    user: {
      _id: userToUpdate._id,
      name: userToUpdate.name,
      email: userToUpdate.email,
      role: userToUpdate.role,
      status: userToUpdate.status,
    },
  });
});

// ================= UPDATE PROFILE =================
const updateUser = asyncWrapper(async (req, res) => {
  const { name, email, password } = req.body;

  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new UnauthenticatedError("User not found");
  }

  if (email && email.toLowerCase() !== user.email) {
    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      throw new BadRequestError("Email already in use");
    }
    user.email = email.toLowerCase();
  }

  if (name) user.name = name;
  if (password) user.password = password;

  await user.save();

  res.status(StatusCodes.OK).json({
    success: true,
    msg: "Profile updated successfully",
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || "active",
    },
  });
});

module.exports = {
  firstAdminSignup,
  register,
  login,
  updateUser,
  updateStatus,
};