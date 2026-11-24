const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['paid_business_promotion', 'featured_business_listing', 'sponsored_article', 'paid_advertisement', 'premium_business_listing', 'business_enquiry_promotion', 'membership'],
    required: true
  },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  amountPaise: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['draft', 'pending_payment', 'active', 'paused', 'expired', 'cancelled'], default: 'draft' },
  relatedBusiness: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  startsAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

promotionSchema.index({ payment: 1 }, {
  unique: true,
  partialFilterExpression: { payment: { $type: 'objectId' } }
});

module.exports = mongoose.model('Promotion', promotionSchema);
