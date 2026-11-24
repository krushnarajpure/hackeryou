const mongoose = require('mongoose');
const adSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  targetUrl: { type: String, required: true },
  placement: { type: String, enum: ['homepage_banner', 'homepage_sidebar', 'directory_featured'], required: true },
  isActive: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  advertiserName: { type: String, default: '' }
}, { timestamps: true });
module.exports = mongoose.model('Advertisement', adSchema);
