const mongoose = require('mongoose');
const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySignature: { type: String, select: false },
  packageType: { type: String, enum: ['free_listing', 'premium_listing', 'featured_promotion', 'advertisement', 'sponsored_article', 'business_promotion', 'business_enquiry_promotion', 'membership'], required: true },
  amountPaise: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
  relatedBusiness: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null }
}, { timestamps: true });
module.exports = mongoose.model('Payment', paymentSchema);
