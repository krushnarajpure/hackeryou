const mongoose = require('mongoose');

const articleAnalyticsSchema = new mongoose.Schema({
  article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true, unique: true },
  totalViews: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model('ArticleAnalytics', articleAnalyticsSchema);
