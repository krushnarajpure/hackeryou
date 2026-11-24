const User = require('../models/User');
const Business = require('../models/Business');
const Category = require('../models/Category');
const Idea = require('../models/BusinessIdea');
const Scheme = require('../models/GovernmentScheme');
const Article = require('../models/Article');
const Enquiry = require('../models/Enquiry');
const Advertisement = require('../models/Advertisement');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const writeAuditLog = require('../utils/writeAuditLog');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Media = require('../models/Media');
const ArticleAnalytics = require('../models/ArticleAnalytics');

exports.dashboard = async (_req, res) => {
  const [users, businesses, pendingBusinesses, categories, ideas, schemes, articles, publishedArticles, draftArticles, pageViewSummary, enquiries, advertisements, payments] = await Promise.all([
    User.countDocuments(), Business.countDocuments(), Business.countDocuments({ approvalStatus: 'pending' }),
    Category.countDocuments(), Idea.countDocuments(), Scheme.countDocuments(), Article.countDocuments(),
    Article.countDocuments({ isPublished: true }), Article.countDocuments({ isPublished: false }),
    ArticleAnalytics.aggregate([{ $group: { _id: null, value: { $sum: '$totalViews' } } }]),
    Enquiry.countDocuments({ status: 'new' }), Advertisement.countDocuments({ approvalStatus: 'pending' }), Payment.countDocuments()
  ]);
  res.json({ statistics: { users, businesses, pendingBusinesses, categories, ideas, schemes, articles, publishedArticles, draftArticles, pageViews: pageViewSummary[0]?.value || 0, newEnquiries: enquiries, pendingAdvertisements: advertisements, payments } });
};

exports.getStorage = async (_req, res) => {
  const db = mongoose.connection.db;
  if (!db) throw Object.assign(new Error('MongoDB is not connected'), { statusCode: 503 });
  const [dbStats, mediaCount, articleCount, mediaStats] = await Promise.all([
    db.command({ dbStats: 1, scale: 1 }),
    Media.countDocuments(),
    Article.countDocuments(),
    Media.aggregate([{ $group: { _id: null, bytes: { $sum: '$size' } } }])
  ]);
  const uploadDir = path.join(__dirname, '..', 'uploads');
  let diskBytes = 0;
  let diskFiles = 0;
  if (fs.existsSync(uploadDir)) {
    for (const entry of fs.readdirSync(uploadDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      diskFiles += 1;
      diskBytes += fs.statSync(path.join(uploadDir, entry.name)).size;
    }
  }
  res.json({
    databaseName: db.databaseName,
    connectionStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    databaseStorageBytes: Number(dbStats.dataSize || 0) + Number(dbStats.indexSize || 0),
    databaseStorageUsedBytes: Number(dbStats.storageSize || dbStats.dataSize || 0),
    imageStorageBytes: diskBytes,
    imageMetadataBytes: Number(mediaStats[0]?.bytes || 0),
    totalUploadedImages: mediaCount,
    diskImageFiles: diskFiles,
    totalArticles: articleCount,
    storageLimitBytes: null,
    remainingBytes: null,
    quotaStatus: 'Quota information unavailable',
    measuredAt: new Date().toISOString()
  });
};
exports.getUsers = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const filter = {};
  if (req.query.role) filter.role = String(req.query.role);
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) filter.$or = [
    { name: new RegExp(require('../utils/escapeRegex')(search), 'i') },
    { email: new RegExp(require('../utils/escapeRegex')(search), 'i') },
    { mobile: new RegExp(require('../utils/escapeRegex')(search), 'i') }
  ];
  const [users, total] = await Promise.all([
    User.find(filter).select('-password -resetPasswordToken -resetPasswordExpires').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);
  res.json({ users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

exports.updateUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (String(user._id) === String(req.user._id) && (req.body.role || req.body.isActive === false)) {
    throw Object.assign(new Error('You cannot change your own role or deactivate your own account'), { statusCode: 400 });
  }
  const allowedFields = ['name', 'email', 'mobile', 'isActive'];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  });
  if (req.body.role !== undefined) {
    if (req.user.role !== 'super_admin') throw Object.assign(new Error('Only a super admin can change user roles'), { statusCode: 403 });
    if (!User.schema.path('role').enumValues.includes(req.body.role)) throw Object.assign(new Error('Invalid role'), { statusCode: 400 });
    if (user.role === 'super_admin' && req.body.role !== 'super_admin') {
      const activeSuperAdmins = await User.countDocuments({ role: 'super_admin', isActive: true });
      if (activeSuperAdmins <= 1) throw Object.assign(new Error('The last active super admin cannot be demoted'), { statusCode: 409 });
    }
    user.role = req.body.role;
  }
  if (req.body.isActive === false && user.role === 'super_admin') {
    const activeSuperAdmins = await User.countDocuments({ role: 'super_admin', isActive: true });
    if (activeSuperAdmins <= 1) throw Object.assign(new Error('The last active super admin cannot be deactivated'), { statusCode: 409 });
  }
  await user.save();
  await writeAuditLog(req, 'user.update', 'user', user._id, `User access updated for ${user.name}`);
  res.json({ user: user.toObject({ transform: (_doc, value) => { delete value.password; delete value.resetPasswordToken; delete value.resetPasswordExpires; return value; } }) });
};
exports.deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (String(user._id) === String(req.user._id)) throw Object.assign(new Error('You cannot delete your own account'), { statusCode: 400 });
  if (user.role === 'super_admin') {
    const activeSuperAdmins = await User.countDocuments({ role: 'super_admin', isActive: true });
    if (activeSuperAdmins <= 1) throw Object.assign(new Error('The last active super admin cannot be deleted'), { statusCode: 409 });
  }
  await user.deleteOne();
  await writeAuditLog(req, 'user.delete', 'user', user._id, `User ${user.name} deleted`);
  res.json({ message: 'User deleted' });
};
exports.approveOrRejectBusiness = async (req, res) => {
  const { approvalStatus, rejectionReason = '' } = req.body;
  if (!['approved', 'rejected'].includes(approvalStatus)) throw Object.assign(new Error('approvalStatus must be approved or rejected'), { statusCode: 400 });
  const business = await Business.findByIdAndUpdate(req.params.id, { approvalStatus, rejectionReason }, { new: true, runValidators: true });
  if (!business) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
  res.json({ business });
};
exports.getPayments = async (_req, res) => res.json({ payments: await Payment.find().populate('user', 'name email mobile').populate('relatedBusiness', 'businessName').sort({ createdAt: -1 }) });
exports.getPayment = async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('user relatedBusiness');
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  res.json({ payment });
};

exports.getAuditLogs = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const filter = {};
  if (req.query.entityType) filter.entityType = String(req.query.entityType).slice(0, 80);
  if (req.query.action) filter.action = String(req.query.action).slice(0, 80);
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'name email role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filter)
  ]);
  res.json({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};
