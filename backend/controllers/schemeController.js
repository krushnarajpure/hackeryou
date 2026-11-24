const Scheme = require('../models/GovernmentScheme');
const mongoose = require('mongoose');
const slugify = require('../utils/slugify');
const escapeRegex = require('../utils/escapeRegex');
exports.createScheme = async (req, res) => {
  const slug = req.body.slug || slugify(req.body.name) || `scheme-${new mongoose.Types.ObjectId()}`;
  const scheme = await Scheme.create({ ...req.body, slug });
  res.status(201).json({ scheme });
};
exports.updateScheme = async (req, res) => {
  const scheme = await Scheme.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!scheme) throw Object.assign(new Error('Scheme not found'), { statusCode: 404 });
  res.json({ scheme });
};
exports.deleteScheme = async (req, res) => {
  const scheme = await Scheme.findByIdAndDelete(req.params.id);
  if (!scheme) throw Object.assign(new Error('Scheme not found'), { statusCode: 404 });
  res.json({ message: 'Scheme deleted' });
};
exports.getSchemes = async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { isActive: true };
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const terms = search.split(/\s+/).filter(Boolean).slice(0, 8);
    const fields = ['name', 'description', 'eligibility', 'benefits', 'documents', 'applicationProcess'];
    filter.$and = terms.map((term) => ({
      $or: fields.map((field) => ({ [field]: new RegExp(escapeRegex(term), 'i') }))
    }));
  }
  res.json({ schemes: await Scheme.find(filter).sort({ createdAt: -1 }) });
};
exports.getScheme = async (req, res) => {
  const filter = mongoose.isValidObjectId(req.params.id) ? { $or: [{ _id: req.params.id }, { slug: req.params.id }] } : { slug: req.params.id };
  const scheme = await Scheme.findOne({ ...filter, isActive: true });
  if (!scheme) throw Object.assign(new Error('Scheme not found'), { statusCode: 404 });
  res.json({ scheme });
};
