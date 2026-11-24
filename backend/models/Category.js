const mongoose = require('mongoose');
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '' },
  image: { type: String, default: '' },
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
module.exports = mongoose.model('Category', categorySchema);
