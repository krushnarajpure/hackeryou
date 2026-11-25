const mongoose = require('mongoose');

const websiteVisitorDaySchema = new mongoose.Schema({
  visitorHash: { type: String, required: true },
  day: { type: String, required: true },
  firstSeenAt: { type: Date, required: true }
}, { versionKey: false });

websiteVisitorDaySchema.index({ visitorHash: 1, day: 1 }, { unique: true });
websiteVisitorDaySchema.index({ day: 1 });

module.exports = mongoose.model('WebsiteVisitorDay', websiteVisitorDaySchema);
