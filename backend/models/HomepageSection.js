const mongoose = require('mongoose');

const featureCardSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, maxlength: 81 },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  subtitle: { type: String, required: true, trim: true, maxlength: 160 },
  icon: { type: String, enum: ['FileCheck', 'Landmark', 'Factory', 'ClipboardList', 'Settings', 'Store'], default: 'FileCheck' },
  image: { type: String, default: '', trim: true, maxlength: 500 },
  path: { type: String, required: true, trim: true, maxlength: 300 },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0, min: 0, max: 1000 }
}, { _id: false });

const homepageSectionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, default: '' },
  categorySlug: { type: String, default: '' },
  limit: { type: Number, default: 6, min: 1, max: 20 },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  articleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article', default: [] }],
  featureCards: { type: [featureCardSchema], default: [] },
  desktopLayout: { type: String, default: 'grid' },
  mobileLayout: { type: String, default: 'list' },
  viewAllLink: { type: String, default: '' },
  background: { type: String, default: '' },
  spacing: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('HomepageSection', homepageSectionSchema);
