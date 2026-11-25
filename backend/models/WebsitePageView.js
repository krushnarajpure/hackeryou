const mongoose = require('mongoose');

const websitePageViewSchema = new mongoose.Schema({
  day: { type: String, required: true },
  path: { type: String, required: true },
  title: { type: String, default: '', maxlength: 200 },
  pageViews: { type: Number, default: 0, min: 0 }
}, { versionKey: false });

websitePageViewSchema.index({ day: 1, path: 1 }, { unique: true });

module.exports = mongoose.model('WebsitePageView', websitePageViewSchema);
