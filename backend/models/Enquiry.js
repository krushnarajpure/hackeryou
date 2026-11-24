const mongoose = require('mongoose');
const enquirySchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  mobile: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  message: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
  ipAddress: { type: String, select: false },
  userAgent: { type: String, select: false }
}, { timestamps: true });
module.exports = mongoose.model('Enquiry', enquirySchema);
