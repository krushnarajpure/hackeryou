const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  subtitle: { type: String, default: '' },
  content: { type: String, required: true },
  sections: { type: mongoose.Schema.Types.Mixed, default: [] },
  pageType: { type: String, default: 'page' },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },
  headerTemplate: { type: String, default: '' },
  footerTemplate: { type: String, default: '' },
  sidebarTemplate: { type: String, default: '' },
  excerpt: { type: String, default: '' },
  featuredImage: { type: String, default: '' },
  sourceUrl: { type: String, default: '', index: true },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  canonicalUrl: { type: String, default: '' },
  pageType: { type: String, enum: ['page', 'landing', 'article'], default: 'page' },
  status: { type: String, enum: ['draft', 'published', 'archived'] },
  isPublished: { type: Boolean, default: true }
}, { timestamps: true });

pageSchema.index({ title: 'text', content: 'text' });
module.exports = mongoose.model('Page', pageSchema);
