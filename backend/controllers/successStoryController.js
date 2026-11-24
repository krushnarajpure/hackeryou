const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const SuccessStory = require('../models/SuccessStory');
const slugify = require('../utils/slugify');

const validate = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw Object.assign(new Error(errors.array().map((error) => error.msg).join(', ')), { statusCode: 400 });
  }
};

const uniqueSlug = async (title) => {
  const base = slugify(title) || `story-${new mongoose.Types.ObjectId()}`;
  let slug = base;
  let suffix = 2;
  while (await SuccessStory.exists({ slug })) slug = `${base}-${suffix++}`;
  return slug;
};

exports.submitStory = async (req, res) => {
  validate(req);
  const story = await SuccessStory.create({
    title: req.body.title.trim(),
    slug: await uniqueSlug(req.body.title),
    entrepreneurName: req.body.entrepreneurName.trim(),
    businessName: req.body.businessName.trim(),
    city: req.body.city.trim(),
    summary: req.body.summary.trim(),
    story: req.body.story.trim(),
    image: req.body.image?.trim() || '',
    isPublished: false
  });
  res.status(201).json({ message: 'Story submitted for review', storyId: story._id });
};

exports.getStories = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const filter = { isPublished: true };
  const [stories, total] = await Promise.all([
    SuccessStory.find(filter).select('title slug entrepreneurName businessName city summary image publicationDate').sort({ publicationDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    SuccessStory.countDocuments(filter)
  ]);
  res.json({ stories, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

exports.getStory = async (req, res) => {
  const filter = mongoose.isValidObjectId(req.params.id)
    ? { $or: [{ slug: req.params.id }, { _id: req.params.id }], isPublished: true }
    : { slug: req.params.id, isPublished: true };
  const story = await SuccessStory.findOne(filter);
  if (!story) throw Object.assign(new Error('Success story not found'), { statusCode: 404 });
  res.json({ story });
};

exports.getAllStories = async (_req, res) => {
  res.json({ stories: await SuccessStory.find().sort({ createdAt: -1 }) });
};

exports.createStory = async (req, res) => {
  const story = await SuccessStory.create({
    ...req.body,
    slug: req.body.slug || await uniqueSlug(req.body.title),
    publicationDate: req.body.isPublished ? (req.body.publicationDate || new Date()) : null
  });
  res.status(201).json({ story });
};

exports.updateStory = async (req, res) => {
  const fields = ['title', 'entrepreneurName', 'businessName', 'city', 'summary', 'story', 'image', 'isPublished', 'publicationDate'];
  const updates = Object.fromEntries(fields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
  if (updates.isPublished && !updates.publicationDate) updates.publicationDate = new Date();
  const story = await SuccessStory.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!story) throw Object.assign(new Error('Success story not found'), { statusCode: 404 });
  res.json({ story });
};

exports.publishStory = async (req, res) => {
  const story = await SuccessStory.findByIdAndUpdate(req.params.id, { isPublished: true, publicationDate: new Date() }, { new: true });
  if (!story) throw Object.assign(new Error('Success story not found'), { statusCode: 404 });
  res.json({ story });
};

exports.deleteStory = async (req, res) => {
  const story = await SuccessStory.findByIdAndDelete(req.params.id);
  if (!story) throw Object.assign(new Error('Success story not found'), { statusCode: 404 });
  res.json({ message: 'Success story deleted' });
};
