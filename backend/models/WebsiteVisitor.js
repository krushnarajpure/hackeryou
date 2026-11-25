const mongoose = require('mongoose');

const websiteVisitorSchema = new mongoose.Schema({
  visitorHash: { type: String, required: true, unique: true },
  firstSeenAt: { type: Date, required: true }
}, { versionKey: false });

module.exports = mongoose.model('WebsiteVisitor', websiteVisitorSchema);
