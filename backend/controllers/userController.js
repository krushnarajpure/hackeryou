const { validationResult } = require('express-validator');
const User = require('../models/User');

const checked = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw Object.assign(new Error(errors.array().map((e) => e.msg).join(', ')), { statusCode: 400 });
};

exports.getProfile = async (req, res) => res.json({ user: req.user });

exports.updateProfile = async (req, res) => {
  checked(req);
  const allowed = ['name', 'email', 'mobile', 'avatar'];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) req.user[key] = req.body[key];
  });
  await req.user.save();
  res.json({ user: req.user });
};

exports.changePassword = async (req, res) => {
  checked(req);
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(req.body.currentPassword))) {
    throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
  }
  user.password = req.body.newPassword;
  await user.save();
  res.json({ message: 'Password changed successfully' });
};
