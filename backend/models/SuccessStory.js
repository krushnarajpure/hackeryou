const mongoose = require('mongoose');

const successStorySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  entrepreneurName: { type: String, required: true, trim: true, maxlength: 100 },
  businessName: { type: String, required: true, trim: true, maxlength: 160 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  summary: { type: String, required: true, trim: true, maxlength: 500 },
  story: { type: String, required: true, trim: true, maxlength: 12000 },
  image: { type: String, default: '' },
  isPublished: { type: Boolean, default: false, index: true },
  publicationDate: { type: Date, default: null }
}, { timestamps: true });

successStorySchema.index({ title: 'text', entrepreneurName: 'text', businessName: 'text', summary: 'text', story: 'text' });

module.exports = mongoose.model('SuccessStory', successStorySchema);
