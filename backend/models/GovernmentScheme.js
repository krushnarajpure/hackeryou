const mongoose = require('mongoose');
const schemeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, required: true },
  eligibility: [String],
  benefits: [String],
  documents: [String],
  applicationProcess: [String],
  officialUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
schemeSchema.index({ name: 'text', description: 'text' });
module.exports = mongoose.model('GovernmentScheme', schemeSchema);
