const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const asyncWrapper = require('../middleware/async'); // centralized error handling
const { BadRequestError, UnauthenticatedError, NotFoundError } = require('../errors');

// ================= Register new user =================
const register = asyncWrapper(async (req, res) => {
  const role = req.body.role || "csr"; // default CSR
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    lastName: req.body.lastName,
    location: req.body.location,
    role
  });

  const token = user.createJWT();
  res.status(StatusCodes.CREATED).json({
    user: {
      email: user.email,
      lastName: user.lastName,
      location: user.location,
      name: user.name,
      role: user.role,
      token,
    },
  });
});

// ================= Login existing user =================
const login = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new BadRequestError('Please provide email and password');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new UnauthenticatedError('Invalid Credentials');
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError('Invalid Credentials');
  }

  const token = user.createJWT();
  res.status(StatusCodes.OK).json({
    user: {
      email: user.email,
      lastName: user.lastName,
      location: user.location,
      name: user.name,
      role: user.role,
      token,
    },
  });
});

// ================= Update existing user =================
const updateUser = asyncWrapper(async (req, res) => {
  const { email, name, lastName, location } = req.body;
  if (!email || !name || !lastName || !location) {
    throw new BadRequestError('Please provide all values');
  }

  const user = await User.findOne({ _id: req.user.userId });
  if (!user) throw new NotFoundError('User not found');

  user.email = email;
  user.name = name;
  user.lastName = lastName;
  user.location = location;

  await user.save();
  const token = user.createJWT();

  res.status(StatusCodes.OK).json({
    user: {
      email: user.email,
      lastName: user.lastName,
      location: user.location,
      name: user.name,
      role: user.role,
      token,
    },
  });
});

module.exports = { register, login, updateUser };
