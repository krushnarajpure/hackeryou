const Idea = require('../models/BusinessIdea');
const Category = require('../models/Category');
const mongoose = require('mongoose');
const slugify = require('../utils/slugify');
const escapeRegex = require('../utils/escapeRegex');
exports.createIdea = async (req, res) => {
  const images = req.files?.map((file) => `/uploads/${file.filename}`) || req.body.images || [];
  const slug = req.body.slug || slugify(req.body.title) || `idea-${new mongoose.Types.ObjectId()}`;
  const idea = await Idea.create({ ...req.body, images, slug });
  res.status(201).json({ idea });
};
exports.updateIdea = async (req, res) => {
  if (req.files?.length) req.body.images = req.files.map((file) => `/uploads/${file.filename}`);
  const idea = await Idea.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!idea) throw Object.assign(new Error('Business idea not found'), { statusCode: 404 });
  res.json({ idea });
};
exports.deleteIdea = async (req, res) => {
  const idea = await Idea.findByIdAndDelete(req.params.id);
  if (!idea) throw Object.assign(new Error('Business idea not found'), { statusCode: 404 });
  res.json({ message: 'Business idea deleted' });
};
exports.submitIdea = async (req, res) => {
  if (!req.body.title?.trim() || !req.body.description?.trim()) {
    throw Object.assign(new Error('Title and description are required'), { statusCode: 400 });
  }
  let category = null;
  if (req.body.categoryName?.trim()) {
    const categorySlug = slugify(req.body.categoryName);
    category = await Category.findOneAndUpdate(
      { slug: categorySlug },
      { name: req.body.categoryName.trim(), slug: categorySlug, isActive: true },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }
  const baseSlug = slugify(req.body.title) || `idea-${new mongoose.Types.ObjectId()}`;
  let slug = baseSlug;
  let suffix = 2;
  while (await Idea.exists({ slug })) slug = `${baseSlug}-${suffix++}`;
  const images = req.files?.map((file) => `/uploads/${file.filename}`) ||
    (Array.isArray(req.body.images) ? req.body.images : req.body.image ? [req.body.image] : []);
  const investment = Number(req.body.investment);
  const idea = await Idea.create({
    title: req.body.title.trim(),
    slug,
    description: req.body.description.trim(),
    category: category?._id,
    investment: Number.isFinite(investment) ? investment : 0,
    investmentLabel: req.body.investmentLabel?.trim() || '',
    machinery: req.body.machinery ? String(req.body.machinery).split('\n').map((item) => item.trim()).filter(Boolean) : [],
    rawMaterials: req.body.rawMaterials ? String(req.body.rawMaterials).split('\n').map((item) => item.trim()).filter(Boolean) : [],
    licenses: req.body.licenses ? String(req.body.licenses).split('\n').map((item) => item.trim()).filter(Boolean) : [],
    process: req.body.process ? String(req.body.process).split('\n').map((item) => item.trim()).filter(Boolean) : [],
    marketing: req.body.marketing ? String(req.body.marketing).split('\n').map((item) => item.trim()).filter(Boolean) : [],
    images,
    isPublished: true
  });
  res.status(201).json({ idea });
};
exports.getIdeas = async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { isPublished: true };
  if (req.query.category) filter.category = req.query.category;
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const terms = search.split(/\s+/).filter(Boolean).slice(0, 8);
    const fields = ['title', 'description', 'machinery', 'rawMaterials', 'licenses', 'process', 'marketing', 'seo.title', 'seo.description', 'seo.keywords'];
    filter.$and = terms.map((term) => ({
      $or: fields.map((field) => ({ [field]: new RegExp(escapeRegex(term), 'i') }))
    }));
  }
  if (req.query.maxInvestment) filter.investment = { $lte: Number(req.query.maxInvestment) };
  if (req.query.minInvestment) filter.investment = { ...(filter.investment || {}), $gte: Number(req.query.minInvestment) };
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 12, 50);
  const [ideas, total] = await Promise.all([Idea.find(filter).populate('category', 'name slug').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Idea.countDocuments(filter)]);
  res.json({ ideas, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};
exports.getIdea = async (req, res) => {
  const filter = mongoose.isValidObjectId(req.params.id) ? { $or: [{ _id: req.params.id }, { slug: req.params.id }] } : { slug: req.params.id };
  const idea = await Idea.findOne({ ...filter, isPublished: true }).populate('category');
  if (!idea) throw Object.assign(new Error('Business idea not found'), { statusCode: 404 });
  res.json({ idea });
};
