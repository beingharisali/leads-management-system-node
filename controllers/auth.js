const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { BadRequestError, UnauthenticatedError } = require('../errors');

// Generate JWT
const createJWT = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

// REGISTER – Only Admin can create new users (CSR/Admin)
const register = async (req, res) => {
  const { name, email, password, role = 'csr' } = req.body;

  if (!name || !email || !password) {
    return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Please provide all values' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Email already in use' });
  }

  const user = await User.create({ name, email, password, role });
  const token = createJWT(user);

  res.status(StatusCodes.CREATED).json({
    user: { name: user.name, email: user.email, role: user.role },
    token,
  });
};

// LOGIN
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Please provide email and password' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new UnauthenticatedError('Invalid Credentials');
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError('Invalid Credentials');
  }

  const token = createJWT(user);

  res.status(StatusCodes.OK).json({
    user: { name: user.name, email: user.email, role: user.role },
    token,
  });
};

// UPDATE PROFILE
const updateUser = async (req, res) => {
  const { name, email } = req.body;
  const user = await User.findById(req.user.userId);

  if (!user) {
    throw new UnauthenticatedError('User not found');
  }

  user.name = name || user.name;
  user.email = email || user.email;

  await user.save();

  res.status(StatusCodes.OK).json({ user, msg: 'Profile updated successfully' });
};

module.exports = { register, login, updateUser };
