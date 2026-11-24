const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  title: { type: String, required: true, maxlength: 180 },
  sku: { type: String, default: '', maxlength: 80 },
  quantity: { type: Number, required: true, min: 1, max: 20 },
  unitAmountPaise: { type: Number, required: true, min: 0 },
  productType: { type: String, enum: ['physical', 'digital'], required: true }
}, { _id: false });

const addressSchema = new mongoose.Schema({
  line1: { type: String, required: true, maxlength: 200 },
  line2: { type: String, default: '', maxlength: 200 },
  city: { type: String, required: true, maxlength: 100 },
  state: { type: String, required: true, maxlength: 100 },
  postalCode: { type: String, required: true, maxlength: 12 },
  country: { type: String, default: 'India', maxlength: 80 }
}, { _id: false });

const policyLinksSchema = new mongoose.Schema({
  privacy: { type: String, required: true, maxlength: 500 },
  shipping: { type: String, required: true, maxlength: 500 },
  returns: { type: String, required: true, maxlength: 500 }
}, { _id: false });

const bookOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true, trim: true, maxlength: 100 },
  customerEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  customerPhone: { type: String, required: true, trim: true, maxlength: 20 },
  shippingAddress: { type: addressSchema, default: null },
  items: { type: [orderItemSchema], required: true, validate: [(items) => items.length > 0, 'At least one book is required'] },
  subtotalPaise: { type: Number, required: true, min: 0 },
  shippingPaise: { type: Number, required: true, min: 0 },
  taxPaise: { type: Number, default: 0, min: 0 },
  amountPaise: { type: Number, required: true, min: 1 },
  policyAcceptedAt: { type: Date, required: true },
  policyLinks: { type: policyLinksSchema, required: true },
  currency: { type: String, default: 'INR', enum: ['INR'] },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled', 'refunded'], default: 'pending' },
  fulfillmentStatus: { type: String, enum: ['unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'unfulfilled' },
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  verifiedAt: { type: Date, default: null },
  stockReserved: { type: Boolean, default: false },
  reservationExpiresAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, autoIndex: false });

module.exports = mongoose.model('BookOrder', bookOrderSchema);
