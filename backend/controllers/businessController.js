const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Business = require('../models/Business');
const slugify = require('../utils/slugify');

const checked = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw Object.assign(new Error(errors.array().map((e) => e.msg).join(', ')), { statusCode: 400 });
};

const canManage = (business, user) => user.role === 'admin' || business.owner.toString() === user._id.toString();
const publicFilters = (query) => {
  const filter = { approvalStatus: 'approved' };
  if (query.category) filter.category = query.category;
  if (query.district) filter.district = new RegExp(`^${query.district}$`, 'i');
  if (query.city) filter.city = new RegExp(`^${query.city}$`, 'i');
  if (query.featured === 'true') filter.listingType = 'featured';
  if (query.search) filter.$text = { $search: query.search };
  return filter;
};

exports.createBusiness = async (req, res) => {
  checked(req);
  const logo = req.files?.logo?.[0] ? `/uploads/${req.files.logo[0].filename}` : req.body.logo || '';
  const images = req.files?.images?.map((file) => `/uploads/${file.filename}`) || [];
  const slug = req.body.slug || slugify(req.body.businessName) || `business-${new mongoose.Types.ObjectId()}`;
  const business = await Business.create({ ...req.body, slug, owner: req.user._id, logo, images, approvalStatus: 'pending' });
  res.status(201).json({ business });
};

exports.getBusinesses = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const filter = req.user?.role === 'admin' && req.query.all === 'true' ? {} : publicFilters(req.query);
  const [businesses, total] = await Promise.all([
    Business.find(filter).populate('category', 'name slug').populate('owner', 'name email mobile').sort({ listingType: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Business.countDocuments(filter)
  ]);
  res.json({ businesses, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

exports.getBusinessById = async (req, res) => {
  const business = await Business.findById(req.params.id).populate('category owner');
  if (!business) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
  res.json({ business });
};

exports.getBusinessBySlug = async (req, res) => {
  const business = await Business.findOne({ slug: req.params.slug, approvalStatus: 'approved' }).populate('category owner');
  if (!business) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
  res.json({ business });
};

exports.updateBusiness = async (req, res) => {
  checked(req);
  const business = await Business.findById(req.params.id);
  if (!business) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
  if (!canManage(business, req.user)) throw Object.assign(new Error('You cannot manage this business'), { statusCode: 403 });
  if (req.files?.logo?.[0]) req.body.logo = `/uploads/${req.files.logo[0].filename}`;
  if (req.files?.images?.length) req.body.images = req.files.images.map((file) => `/uploads/${file.filename}`);
  ['approvalStatus', 'listingType', 'rejectionReason', 'owner'].forEach((key) => {
    if (req.user.role !== 'admin') delete req.body[key];
  });
  Object.assign(business, req.body);
  await business.save();
  res.json({ business });
};

exports.deleteBusiness = async (req, res) => {
  const business = await Business.findById(req.params.id);
  if (!business) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
  if (!canManage(business, req.user)) throw Object.assign(new Error('You cannot manage this business'), { statusCode: 403 });
  await business.deleteOne();
  res.json({ message: 'Business deleted successfully' });
};
