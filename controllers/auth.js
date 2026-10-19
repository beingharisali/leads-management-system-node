const User = require("../models/User");
const { cleanPermissions } = User;
const Lead = require("../models/leads");
const Admission = require("../models/Admission");
const Task = require("../models/Task");
const RecurringTask = require("../models/RecurringTask");
const Notification = require("../models/Notification");
const { StatusCodes } = require("http-status-codes");
const jwt = require("jsonwebtoken");
const asyncWrapper = require("../middleware/async");
const { BadRequestError, UnauthenticatedError, NotFoundError, ForbiddenError } = require("../errors");
const mongoose = require("mongoose");
const { recordLogin } = require("./activity");

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
    throw new ForbiddenError("Only an admin can create agents.");
  }
  const { name, email, password, role = "csr", personalPhone, officialPhone } = req.body;
  if (!name || !email || !password) {
    throw new BadRequestError("Name, email and password are required.");
  }
  // A staff member with account access can only add CSRs / staff, and
  // only the admin decides who gets extra access
  if (req.user.staffAccess && !["csr", "staff"].includes(String(role).toLowerCase())) {
    throw new ForbiddenError("You can only create CSR or staff accounts.");
  }
  const permissions = req.user.staffAccess ? [] : cleanPermissions(String(role).toLowerCase(), req.body.permissions);
  if (role.toLowerCase() === "csr" && (!personalPhone?.trim() || !officialPhone?.trim())) {
    throw new BadRequestError("Personal number and official/allotted number are required.");
  }
  const emailExists = await User.findOne({ email: email.toLowerCase() });
  if (emailExists) {
    throw new BadRequestError(
      `An account with the email "${email.toLowerCase()}" already exists (${emailExists.name}). Please use a different email.`
    );
  }
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: role.toLowerCase(),
    status: "active",
    personalPhone: personalPhone?.trim() || "",
    officialPhone: officialPhone?.trim() || "",
    permissions,
  });
  res.status(StatusCodes.CREATED).json({
    success: true,
    msg: "User created successfully",
    user: { _id: user._id, name: user.name, status: user.status, permissions: user.permissions }
  });
});

// ================= LOGIN =================
const login = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new BadRequestError("Please enter your email and password.");
  }
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new UnauthenticatedError("Incorrect email or password.");
  }

  // Strict Block for deactivated CSRs and staff
  if ((user.role === "csr" || user.role === "staff") && user.status === "inactive") {
    throw new UnauthenticatedError("Your account has been deactivated. Please contact Admin.");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new UnauthenticatedError("Incorrect email or password.");
  }
  const token = createJWT(user);
  if (user.role === "csr") await recordLogin(user._id);
  res.status(StatusCodes.OK).json({
    success: true,
    token,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status || "active", permissions: user.permissions || [] },
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
    throw new BadRequestError("Invalid status. It must be either 'active' or 'inactive'.");
  }

  // 2. Security Check
  if (req.user.role !== "admin") {
    throw new ForbiddenError("Only an admin can change an agent's status.");
  }

  if (req.user.staffAccess && String(id) === String(req.user.userId)) {
    throw new ForbiddenError("You can't change your own account's status.");
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

// ================= GET CURRENT USER (ME) =================
const getSingleUser = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  if (!user) throw new UnauthenticatedError("Your account no longer exists. Please log in again.");

  res.status(StatusCodes.OK).json({
    success: true,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status || "active", permissions: user.permissions || [] },
  });
});

// ================= GET ALL CSRs (ADMIN ONLY) =================
const getAllCSRs = asyncWrapper(async (req, res) => {
  const csrs = await User.find({ role: "csr" }).select("-password").sort({ name: 1 }).lean();

  res.status(StatusCodes.OK).json({
    success: true,
    count: csrs.length,
    data: csrs,
  });
});

// ================= UPDATE PROFILE =================
const updateUser = asyncWrapper(async (req, res) => {
  const { name, email, password } = req.body;
  const user = await User.findById(req.user.userId);
  if (!user) throw new UnauthenticatedError("Your account no longer exists. Please log in again.");

  if (email && email.toLowerCase() !== user.email) {
    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) throw new BadRequestError(`The email "${email.toLowerCase()}" is already used by another account.`);
    user.email = email.toLowerCase();
  }
  if (name) user.name = name;
  if (password) user.password = password;

  await user.save();
  res.status(StatusCodes.OK).json({
    success: true,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status || "active", permissions: user.permissions || [] },
  });
});

// ================= GET ONE CSR (ADMIN ONLY) =================
const getAgent = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError(`Agent with ID ${id} not found.`);
  const user = await User.findOne({ _id: id, role: "csr" }).select("-password");
  if (!user) throw new NotFoundError(`Agent with ID ${id} not found.`);
  res.status(StatusCodes.OK).json({ success: true, data: user });
});

// ================= UPDATE CSR PHONE NUMBERS (ADMIN ONLY) =================
const updateAgentPhones = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError(`Agent with ID ${id} not found.`);

  const update = {};
  for (const field of ["personalPhone", "officialPhone"]) {
    if (req.body[field] === undefined) continue;
    const value = String(req.body[field]).trim();
    if (!value) throw new BadRequestError("Number cannot be empty");
    update[field] = value;
  }
  if (!Object.keys(update).length) throw new BadRequestError("No number was provided to update.");

  const user = await User.findOneAndUpdate(
    { _id: id, role: "csr" },
    { $set: update },
    { new: true, runValidators: true }
  ).select("-password");
  if (!user) throw new NotFoundError(`Agent with ID ${id} not found.`);

  res.status(StatusCodes.OK).json({ success: true, data: user });
});

/* ================= TEAM ACCOUNTS (CSRs + STAFF) ================= */

const ACCOUNT_ROLES = ["csr", "staff"];
const ACCOUNT_FIELDS = "name email role status permissions personalPhone officialPhone createdAt";

const findAccountOr404 = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError("Account not found.");
  const user = await User.findOne({ _id: id, role: { $in: ACCOUNT_ROLES } });
  if (!user) throw new NotFoundError("Account not found.");
  return user;
};

// GET /auth/accounts - every CSR and staff account with its access
const getAccounts = asyncWrapper(async (req, res) => {
  const accounts = await User.find({ role: { $in: ACCOUNT_ROLES } })
    .select(ACCOUNT_FIELDS)
    .sort({ role: 1, name: 1 })
    .lean();
  res.status(StatusCodes.OK).json({
    success: true,
    data: accounts.map((a) => ({ ...a, permissions: a.permissions || [] })),
  });
});

// PATCH /auth/accounts/:id/access { permissions: [] } - admin only
const updateAccess = asyncWrapper(async (req, res) => {
  const user = await findAccountOr404(req.params.id);
  user.permissions = cleanPermissions(user.role, req.body?.permissions);
  await user.save();
  res.status(StatusCodes.OK).json({
    success: true,
    data: { _id: user._id, name: user.name, role: user.role, permissions: user.permissions },
  });
});

// GET /auth/accounts/:id/delete-check - what deleting this account affects
const getDeleteCheck = asyncWrapper(async (req, res) => {
  const user = await findAccountOr404(req.params.id);
  const [leads, admissions, openTasks, repeatingTasks] = await Promise.all([
    Lead.countDocuments({ assignedTo: user._id }),
    Admission.countDocuments({ csr: user._id }),
    Task.countDocuments({ assignedTo: user._id, status: { $in: Task.OPEN_STATUSES } }),
    RecurringTask.countDocuments({ assignedTo: user._id, active: true }),
  ]);
  res.status(StatusCodes.OK).json({
    success: true,
    data: { _id: user._id, name: user.name, role: user.role, leads, admissions, openTasks, repeatingTasks },
  });
});

// DELETE /auth/accounts/:id?reassignTo=<csrId> - admin only.
// Removes the login account for good. Leads, sales, admissions and task
// history are kept; a CSR's leads (and admissions) can be moved to another
// CSR first. Their open tasks are cancelled and repeating tasks stopped.
const deleteAccount = asyncWrapper(async (req, res) => {
  const user = await findAccountOr404(req.params.id);
  if (String(user._id) === String(req.user.userId)) throw new BadRequestError("You can't delete your own account.");

  let movedTo = null;
  const reassignTo = String(req.query.reassignTo || "").trim();
  if (reassignTo) {
    if (user.role !== "csr") throw new BadRequestError("Only a CSR's leads can be moved.");
    if (!mongoose.Types.ObjectId.isValid(reassignTo) || reassignTo === String(user._id)) {
      throw new BadRequestError("Please choose another CSR to move the leads to.");
    }
    movedTo = await User.findOne({ _id: reassignTo, role: "csr" }).select("name status").lean();
    if (!movedTo) throw new BadRequestError("The CSR to move the leads to was not found.");
    if (movedTo.status === "inactive") throw new BadRequestError(`${movedTo.name}'s account is deactivated. Choose an active CSR.`);
  }

  const now = new Date();
  const result = { leadsMoved: 0, admissionsMoved: 0, tasksCancelled: 0, repeatingStopped: 0 };

  if (movedTo) {
    result.leadsMoved = (await Lead.updateMany({ assignedTo: user._id }, { $set: { assignedTo: movedTo._id } })).modifiedCount;
    result.admissionsMoved = (await Admission.updateMany({ csr: user._id }, { $set: { csr: movedTo._id } })).modifiedCount;
  }

  result.tasksCancelled = (await Task.updateMany(
    { assignedTo: user._id, status: { $in: Task.OPEN_STATUSES } },
    {
      $set: { status: "cancelled", cancelledAt: now },
      $push: { history: { action: "cancelled", by: req.user.userId, at: now, note: `${user.name}'s account was deleted` } },
    }
  )).modifiedCount;
  result.repeatingStopped = (await RecurringTask.updateMany(
    { assignedTo: user._id, active: true },
    { $set: { active: false } }
  )).modifiedCount;
  await Notification.deleteMany({ recipient: user._id });

  await User.deleteOne({ _id: user._id });

  res.status(StatusCodes.OK).json({
    success: true,
    msg: `${user.name}'s account was deleted.`,
    data: { ...result, movedTo: movedTo ? { _id: movedTo._id, name: movedTo.name } : null },
  });
});

module.exports = {
  getAccounts,
  updateAccess,
  getDeleteCheck,
  deleteAccount,
  getAgent,
  updateAgentPhones,
  firstAdminSignup,
  register,
  login,
  updateUser,
  updateStatus,
  getAllCSRs,
  getSingleUser
};