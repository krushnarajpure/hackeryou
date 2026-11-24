const crypto = require('crypto');
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Promotion = require('../models/Promotion');
const Business = require('../models/Business');

const allowedPackages = {
  business_promotion: 49900,
  premium_listing: 99900,
  featured_promotion: 299900,
  advertisement: 499900,
  sponsored_article: 499900,
  business_enquiry_promotion: 29900,
  membership: 199900
};

const promotionDetails = {
  business_promotion: { type: 'paid_business_promotion', title: 'Paid Business Promotion' },
  premium_listing: { type: 'premium_business_listing', title: 'Premium Business Listing' },
  featured_promotion: { type: 'featured_business_listing', title: 'Featured Business Listing' },
  advertisement: { type: 'paid_advertisement', title: 'Paid Advertisement' },
  sponsored_article: { type: 'sponsored_article', title: 'Sponsored Article' },
  business_enquiry_promotion: { type: 'business_enquiry_promotion', title: 'Business Enquiry Promotion' },
  membership: { type: 'membership', title: 'Premium Membership' }
};

const activatePromotion = async (payment) => {
  const details = promotionDetails[payment.packageType];
  if (!details) throw new Error(`No promotion configuration for ${payment.packageType}`);
  await Promotion.findOneAndUpdate(
    { payment: payment._id },
    {
      $set: {
        user: payment.user,
        type: details.type,
        title: details.title,
        amountPaise: payment.amountPaise,
        relatedBusiness: payment.relatedBusiness,
        status: 'active'
      }
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
};

const markPaymentCaptured = async (payment, entity) => {
  if (entity.amount !== payment.amountPaise || entity.currency !== payment.currency) {
    throw Object.assign(new Error('Captured payment amount or currency does not match the order'), { statusCode: 400 });
  }
  const updatedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: 'paid' } },
    { $set: { razorpayPaymentId: entity.id, status: 'paid' } },
    { new: true, runValidators: true }
  );
  const settledPayment = updatedPayment || await Payment.findById(payment._id);
  if (!settledPayment) throw Object.assign(new Error('Payment record not found'), { statusCode: 404 });
  if (settledPayment.razorpayPaymentId !== entity.id) {
    throw Object.assign(new Error('A different payment is already recorded for this order'), { statusCode: 409 });
  }
  await activatePromotion(settledPayment);
  return settledPayment;
};

exports.createOrder = async (req, res) => {
  const { packageType, relatedBusiness } = req.body;
  if (packageType === 'free_listing') throw Object.assign(new Error('Free listing does not require payment'), { statusCode: 400 });
  if (!allowedPackages[packageType]) throw Object.assign(new Error('Invalid package type'), { statusCode: 400 });
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw Object.assign(new Error('Razorpay is not configured'), { statusCode: 503 });
  }
  if (relatedBusiness) {
    const business = await Business.findById(relatedBusiness);
    if (!business || (req.user.role !== 'admin' && business.owner.toString() !== req.user._id.toString())) {
      throw Object.assign(new Error('Business not found or not owned by this account'), { statusCode: 404 });
    }
  }
  const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  const order = await razorpay.orders.create({ amount: allowedPackages[packageType], currency: 'INR', receipt: `mu_${req.user._id}_${Date.now()}` });
  const payment = await Payment.create({
    user: req.user._id,
    razorpayOrderId: order.id,
    packageType,
    amountPaise: allowedPackages[packageType],
    relatedBusiness: relatedBusiness || null,
    status: 'created'
  });
  res.status(201).json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: order.amount, currency: order.currency, paymentId: payment._id });
};

exports.verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) throw Object.assign(new Error('Payment verification fields are required'), { statusCode: 400 });
  if (!process.env.RAZORPAY_KEY_SECRET) throw Object.assign(new Error('Razorpay is not configured'), { statusCode: 503 });
  const payment = await Payment.findOne({ razorpayOrderId, user: req.user._id });
  if (!payment) throw Object.assign(new Error('Payment record not found'), { statusCode: 404 });
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
  const supplied = Buffer.from(razorpaySignature);
  const calculated = Buffer.from(expected);
  if (supplied.length !== calculated.length || !crypto.timingSafeEqual(calculated, supplied)) {
    throw Object.assign(new Error('Payment signature verification failed'), { statusCode: 400 });
  }
  const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  const capturedPayment = await razorpay.payments.fetch(razorpayPaymentId);
  if (capturedPayment.order_id !== razorpayOrderId || capturedPayment.status !== 'captured') {
    throw Object.assign(new Error('Payment has not been captured for this order'), { statusCode: 400 });
  }
  const verifiedPayment = await markPaymentCaptured(payment, capturedPayment);
  res.json({ message: 'Payment verified', payment: { id: verifiedPayment._id, status: verifiedPayment.status, packageType: verifiedPayment.packageType } });
};

exports.paymentHistory = async (req, res) => {
  const payments = await Payment.find({ user: req.user._id })
    .populate('relatedBusiness', 'businessName')
    .sort({ createdAt: -1 });
  res.json({ payments });
};

exports.webhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw Object.assign(new Error('Razorpay webhook secret is not configured'), { statusCode: 503 });
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) throw Object.assign(new Error('Webhook signature is required'), { statusCode: 400 });
  const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body)));
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const supplied = Buffer.from(signature);
  const calculated = Buffer.from(expected);
  if (supplied.length !== calculated.length || !crypto.timingSafeEqual(calculated, supplied)) {
    throw Object.assign(new Error('Webhook signature verification failed'), { statusCode: 400 });
  }
  const event = req.rawBody ? JSON.parse(req.rawBody.toString('utf8')) : (Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body);
  const eventName = event.event;
  const entity = event.payload?.payment?.entity;
  if (entity?.order_id && eventName === 'payment.captured') {
    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
    if (!payment) throw Object.assign(new Error('Payment order not found'), { statusCode: 404 });
    await markPaymentCaptured(payment, entity);
  } else if (entity?.order_id && eventName === 'payment.failed') {
    await Payment.findOneAndUpdate(
      { razorpayOrderId: entity.order_id, status: 'created' },
      { $set: { razorpayPaymentId: entity.id || '', status: 'failed' } }
    );
  }
  res.json({ received: true });
};
