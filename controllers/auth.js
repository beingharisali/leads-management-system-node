const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, UnauthenticatedError } = require("../errors");

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
    throw new BadRequestError("Please provide all values");
  }

  const adminExists = await User.findOne({ role: "admin" });
  if (adminExists) {
    throw new BadRequestError("Admin already exists. Please login.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: "admin",
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
    password: await bcrypt.hash(password, 10),
    role: role.toLowerCase(),
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    msg: "User created successfully",
  });
});

// ================= LOGIN =================
const login = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError("Please provide email and password");
  }

  // 👇 SAFE LOGIN (password explicitly selected)
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
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

  if (password) {
    user.password = await bcrypt.hash(password, 10);
  }

  await user.save();

  res.status(StatusCodes.OK).json({
    success: true,
    msg: "Profile updated successfully",
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

module.exports = {
  firstAdminSignup,
  register,
  login,
  updateUser,
};
