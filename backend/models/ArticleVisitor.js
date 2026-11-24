const mongoose = require('mongoose');

const articleVisitorSchema = new mongoose.Schema({
  article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
  visitorHash: { type: String, required: true },
  firstSeenAt: { type: Date, default: Date.now }
}, { timestamps: false });

articleVisitorSchema.index({ article: 1, visitorHash: 1 }, { unique: true });

module.exports = mongoose.model('ArticleVisitor', articleVisitorSchema);
