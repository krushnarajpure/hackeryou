const mongoose = require('mongoose');
const articleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  subtitle: { type: String, default: '' },
  content: { type: String, required: true },
  excerpt: { type: String, default: '', maxlength: 1000 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, default: 'मराठी उद्योजक' },
  category: { type: String, default: 'General' },
  additionalCategories: [{ type: String, trim: true }],
  image: { type: String, default: '' },
  featuredImage: { type: String, default: '' },
  images: [{ type: String }],
  sourceUrl: { type: String, default: '', index: true },
  readingTime: { type: Number, default: 3 },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  canonicalUrl: { type: String, default: '' },
  ogImage: { type: String, default: '' },
  tags: [{ type: String, trim: true }],
  keywords: [{ type: String, trim: true }],
  comments: [{
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, maxlength: 254 },
    website: { type: String, trim: true, maxlength: 500 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    articleTitle: { type: String, trim: true },
    articleSlug: { type: String, trim: true },
    isApproved: { type: Boolean, default: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'] },
    createdAt: { type: Date, default: Date.now }
  }],
  publicationDate: { type: Date, default: null },
  isPublished: { type: Boolean, default: false },
  scheduledAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null }
}, { timestamps: true });
articleSchema.index({ title: 'text', content: 'text', seoDescription: 'text' });
articleSchema.pre('validate', function normalizePublicAuthorName() {
  this.authorName = 'मराठी उद्योजक';
});
articleSchema.set('toJSON', {
  transform: (_document, result) => {
    result.authorName = 'मराठी उद्योजक';
    return result;
  }
});
module.exports = mongoose.model('Article', articleSchema);
