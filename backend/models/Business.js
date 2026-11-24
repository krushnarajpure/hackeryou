const mongoose = require('mongoose');
const businessSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  businessName: { type: String, required: true, trim: true, maxlength: 160 },
  ownerName: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  description: { type: String, required: true, maxlength: 3000 },
  address: { type: String, required: true },
  district: { type: String, required: true, index: true },
  city: { type: String, required: true },
  state: { type: String, default: 'Maharashtra' },
  mobile: { type: String, required: true },
  whatsapp: { type: String, default: '' },
  email: { type: String, lowercase: true, trim: true },
  website: { type: String, default: '' },
  logo: { type: String, default: '' },
  images: [{ type: String }],
  listingType: { type: String, enum: ['free', 'premium', 'featured'], default: 'free' },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  rejectionReason: { type: String, default: '' },
  slug: { type: String, required: true, unique: true, lowercase: true }
}, { timestamps: true });
businessSchema.index({ businessName: 'text', description: 'text', city: 'text', district: 'text' });
module.exports = mongoose.model('Business', businessSchema);
