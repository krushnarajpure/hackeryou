const Category = require('../models/Category');
const mongoose = require('mongoose');
const slugify = require('../utils/slugify');
exports.createCategory = async (req, res) => {
  const slug = req.body.slug || slugify(req.body.name) || `category-${new mongoose.Types.ObjectId()}`;
  const category = await Category.create({ ...req.body, slug });
  res.status(201).json({ category });
};
exports.updateCategory = async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!category) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  res.json({ category });
};
exports.deleteCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  const Article = require('../models/Article');
  const articleCount = await Article.countDocuments({
    $or: [{ category: category.name }, { additionalCategories: category.name }]
  });
  if (articleCount) {
    throw Object.assign(new Error('Category has articles; archive it instead of deleting it'), { statusCode: 409 });
  }
  await category.deleteOne();
  res.json({ message: 'Category deleted' });
};
exports.getCategories = async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { isActive: true };
  res.json({ categories: await Category.find(filter).sort({ name: 1 }) });
};
exports.getCategory = async (req, res) => {
  const filter = mongoose.isValidObjectId(req.params.id) ? { $or: [{ _id: req.params.id }, { slug: req.params.id }] } : { slug: req.params.id };
  const category = await Category.findOne(filter);
  if (!category) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  res.json({ category });
};
