const mongoose = require('mongoose');
const ideaSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  investment: { type: Number, default: 0 },
  investmentLabel: { type: String, default: '' },
  machinery: [String],
  rawMaterials: [String],
  licenses: [String],
  process: [String],
  marketing: [String],
  images: [String],
  seo: { title: String, description: String, keywords: [String] },
  isPublished: { type: Boolean, default: true }
}, { timestamps: true });
ideaSchema.index({ title: 'text', description: 'text' });
module.exports = mongoose.model('BusinessIdea', ideaSchema);
