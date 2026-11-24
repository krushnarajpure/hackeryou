const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const validate = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error(errors.array().map((item) => item.msg).join(', '));
    error.statusCode = 400;
    throw error;
  }
};

exports.register = async (req, res) => {
  validate(req);
  const { name, email, mobile, password } = req.body;
  if (!email && !mobile) throw Object.assign(new Error('Email or mobile is required'), { statusCode: 400 });
  const existing = await User.findOne({ $or: [...(email ? [{ email }] : []), ...(mobile ? [{ mobile }] : [])] });
  if (existing) throw Object.assign(new Error('An account with that email or mobile already exists'), { statusCode: 409 });
  const user = await User.create({ name, email, mobile, password });
  res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, mobile: user.mobile, role: user.role }, token: generateToken(user) });
};

exports.login = async (req, res) => {
  validate(req);
  const { identifier, email, mobile, password } = req.body;
  const loginValue = String(identifier || email || mobile || '').trim().toLowerCase();
  if (!loginValue || !password) throw Object.assign(new Error('Credentials are required'), { statusCode: 400 });
  const user = await User.findOne({ $or: [{ email: loginValue }, { mobile: loginValue }] }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  if (!user.isActive) throw Object.assign(new Error('Account is inactive'), { statusCode: 403 });
  res.json({ user: { id: user._id, name: user.name, email: user.email, mobile: user.mobile, role: user.role }, token: generateToken(user) });
};

exports.logout = async (_req, res) => res.json({ message: 'Logout successful. Discard the access token on the client.' });

exports.forgotPassword = async (req, res) => {
  validate(req);
  const identifier = (req.body.email || req.body.mobile || '').toLowerCase();
  const user = await User.findOne({ $or: [{ email: identifier }, { mobile: identifier }] }).select('+resetPasswordToken +resetPasswordExpires');
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
  }
  res.json({ message: 'If the account exists, password reset instructions will be sent.' });
};

exports.resetPassword = async (req, res) => {
  validate(req);
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() }
  }).select('+password +resetPasswordToken +resetPasswordExpires');
  if (!user) throw Object.assign(new Error('Reset token is invalid or expired'), { statusCode: 400 });
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  res.json({ message: 'Password reset successful', token: generateToken(user) });
};
