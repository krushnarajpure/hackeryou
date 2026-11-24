const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const Book = require('../models/Book');
const BookOrder = require('../models/BookOrder');
const WebsiteSettings = require('../models/WebsiteSettings');
const AuditLog = require('../models/AuditLog');
const writeAuditLog = require('../utils/writeAuditLog');
const escapeRegex = require('../utils/escapeRegex');

const publicBookFields = 'title slug author description language isbn category coverImage productType pricePaise salePricePaise stock sku shippingWeightGrams status seoTitle seoDescription createdAt updatedAt';
const orderBookFields = `${publicBookFields} reservedStock`;

const getProvider = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keyId.startsWith('rzp_test_') || !keySecret || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw Object.assign(new Error('Book checkout requires server-side Razorpay test credentials. Live keys are not accepted.'), { statusCode: 503 });
  }
  return { keyId, razorpay: new Razorpay({ key_id: keyId, key_secret: keySecret }) };
};

const isSafePolicyUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const getCheckoutSettings = async () => {
  const settings = await WebsiteSettings.findOne({ key: 'main' }).select('store').lean();
  const store = settings?.store;
  if (!store?.checkoutEnabled) throw Object.assign(new Error('Book checkout is disabled in Website Settings'), { statusCode: 503 });
  if (!isSafePolicyUrl(store.privacyPolicyUrl) || !isSafePolicyUrl(store.shippingPolicyUrl) || !isSafePolicyUrl(store.returnPolicyUrl)) {
    throw Object.assign(new Error('Privacy, shipping and returns policy links must be configured before checkout'), { statusCode: 503 });
  }
  if (!['inclusive', 'exclusive'].includes(store.taxTreatment)) {
    throw Object.assign(new Error('Tax treatment must be configured before checkout'), { statusCode: 503 });
  }
  if (store.taxTreatment === 'exclusive' && !Number.isInteger(store.taxRateBasisPoints)) {
    throw Object.assign(new Error('Tax rate must be configured before checkout'), { statusCode: 503 });
  }
  if (store.taxTreatment === 'exclusive' && (store.taxRateBasisPoints < 0 || store.taxRateBasisPoints > 10000)) {
    throw Object.assign(new Error('Tax rate must be between 0 and 10000 basis points'), { statusCode: 503 });
  }
  if (!Number.isSafeInteger(store.shippingFeePaise) || store.shippingFeePaise < 0) {
    throw Object.assign(new Error('Shipping fee must be configured before checkout'), { statusCode: 503 });
  }
  return store;
};

exports.checkoutConfig = async (_req, res) => {
  const settings = await WebsiteSettings.findOne({ key: 'main' }).select('store').lean();
  const store = settings?.store || {};
  const policiesReady = isSafePolicyUrl(store.privacyPolicyUrl) && isSafePolicyUrl(store.shippingPolicyUrl) && isSafePolicyUrl(store.returnPolicyUrl);
  const shippingReady = Number.isInteger(store.shippingFeePaise) && store.shippingFeePaise >= 0;
  const taxReady = ['inclusive', 'exclusive'].includes(store.taxTreatment)
    && (store.taxTreatment !== 'exclusive' || Number.isInteger(store.taxRateBasisPoints));
  const testGatewayReady = Boolean(
    process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')
    && process.env.RAZORPAY_KEY_SECRET
    && process.env.RAZORPAY_WEBHOOK_SECRET
  );
  const checkoutAvailable = Boolean(store.checkoutEnabled && policiesReady && shippingReady && taxReady && testGatewayReady);
  res.json({
    checkoutAvailable,
    paymentMode: testGatewayReady ? 'test' : 'unconfigured',
    shippingFeePaise: Number.isInteger(store.shippingFeePaise) ? store.shippingFeePaise : null,
    taxTreatment: store.taxTreatment || null,
    taxRateBasisPoints: Number.isInteger(store.taxRateBasisPoints) ? store.taxRateBasisPoints : null,
    policies: {
      privacy: store.privacyPolicyUrl || '',
      shipping: store.shippingPolicyUrl || '',
      returns: store.returnPolicyUrl || ''
    }
  });
};

const normalizeAddress = (address) => {
  if (!address || typeof address !== 'object') return null;
  const result = {};
  for (const field of ['line1', 'line2', 'city', 'state', 'postalCode', 'country']) {
    result[field] = String(address[field] || '').trim().slice(0, field === 'line1' || field === 'line2' ? 200 : 100);
  }
  if (!result.line1 || !result.city || !result.state || !/^[A-Za-z0-9 -]{4,12}$/.test(result.postalCode)) {
    throw Object.assign(new Error('A valid shipping address and postal code are required'), { statusCode: 400 });
  }
  result.country = result.country || 'India';
  return result;
};

const orderItemsFrom = async (inputItems) => {
  if (!Array.isArray(inputItems) || inputItems.length < 1 || inputItems.length > 10) {
    throw Object.assign(new Error('Choose between 1 and 10 books'), { statusCode: 400 });
  }
  const quantities = new Map();
  for (const item of inputItems) {
    const id = String(item.bookId || '');
    const quantity = Number(item.quantity);
    if (!mongoose.isValidObjectId(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw Object.assign(new Error('Book and quantity are invalid'), { statusCode: 400 });
    }
    const combinedQuantity = (quantities.get(id) || 0) + quantity;
    if (combinedQuantity > 20) throw Object.assign(new Error('Combined quantity cannot exceed 20 per book'), { statusCode: 400 });
    quantities.set(id, combinedQuantity);
  }
  const books = await Book.find({ _id: { $in: [...quantities.keys()] }, status: 'published' }).select(orderBookFields).lean();
  if (books.length !== quantities.size) throw Object.assign(new Error('One or more books are no longer available'), { statusCode: 409 });
  const items = books.map((book) => {
    const quantity = quantities.get(String(book._id));
    if (book.productType === 'digital') throw Object.assign(new Error('Digital book delivery is not configured yet'), { statusCode: 503 });
    if (book.stock - (book.reservedStock || 0) < quantity) throw Object.assign(new Error(`Insufficient stock for "${book.title}"`), { statusCode: 409 });
    const unitAmountPaise = book.salePricePaise ?? book.pricePaise;
    if (!Number.isInteger(unitAmountPaise) || unitAmountPaise < 1) throw Object.assign(new Error(`Invalid price for "${book.title}"`), { statusCode: 409 });
    return {
      book: book._id,
      title: book.title,
      sku: book.sku,
      quantity,
      unitAmountPaise,
      productType: book.productType
    };
  });
  return items;
};

const reserveStock = async (items, session) => {
  const reserved = [];
  for (const item of items.filter((entry) => entry.productType === 'physical')) {
    const result = await Book.updateOne(
      { _id: item.book, $expr: { $gte: [{ $subtract: ['$stock', '$reservedStock'] }, item.quantity] } },
      { $inc: { reservedStock: item.quantity } },
      { session }
    );
    if (result.modifiedCount !== 1) throw Object.assign(new Error(`Insufficient stock for "${item.title}"`), { statusCode: 409 });
    reserved.push(item);
  }
  return reserved;
};

const markOrderPaid = async (orderId, payment) => {
  const session = await mongoose.startSession();
  let paidOrder;
  try {
    await session.withTransaction(async () => {
      const order = await BookOrder.findById(orderId).session(session);
      if (!order) throw Object.assign(new Error('Book order not found'), { statusCode: 404 });
      if (order.paymentStatus === 'paid') {
        if (order.razorpayPaymentId !== payment.id) throw Object.assign(new Error('A different payment is already recorded for this order'), { statusCode: 409 });
        paidOrder = order;
        return;
      }
      if (order.paymentStatus !== 'pending') throw Object.assign(new Error('Order is no longer awaiting payment'), { statusCode: 409 });
      for (const item of order.items.filter((entry) => entry.productType === 'physical')) {
        const result = await Book.updateOne(
          { _id: item.book, stock: { $gte: item.quantity }, reservedStock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity, reservedStock: -item.quantity } },
          { session }
        );
        if (result.modifiedCount !== 1) throw Object.assign(new Error(`Inventory reconciliation required for "${item.title}"`), { statusCode: 409 });
      }
      order.paymentStatus = 'paid';
      order.fulfillmentStatus = 'processing';
      order.razorpayPaymentId = payment.id;
      order.verifiedAt = new Date();
      order.stockReserved = false;
      order.reservationExpiresAt = null;
      paidOrder = await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return paidOrder;
};

const markOrderFailed = async (razorpayOrderId, paymentId = '') => {
  const session = await mongoose.startSession();
  let failedOrder;
  try {
    await session.withTransaction(async () => {
      const order = await BookOrder.findOne({ razorpayOrderId, paymentStatus: 'pending' }).session(session);
      if (!order) return;
      if (order.stockReserved) {
        for (const item of order.items.filter((entry) => entry.productType === 'physical')) {
          const result = await Book.updateOne(
            { _id: item.book, reservedStock: { $gte: item.quantity } },
            { $inc: { reservedStock: -item.quantity } },
            { session }
          );
          if (result.modifiedCount !== 1) throw new Error(`Could not release reserved inventory for order ${order.orderNumber}`);
        }
      }
      order.paymentStatus = 'failed';
      order.fulfillmentStatus = 'cancelled';
      order.razorpayPaymentId = paymentId;
      order.stockReserved = false;
      order.reservationExpiresAt = null;
      failedOrder = await order.save({ session });
      await AuditLog.create([{
        source: 'system',
        action: 'order.payment_failed',
        entityType: 'book-order',
        entityId: String(order._id),
        summary: `Payment failed for order ${order.orderNumber}`
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  return failedOrder;
};

exports.listBooks = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const filter = { status: 'published' };
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: pattern }, { author: pattern }, { category: pattern }, { description: pattern }];
  }
  if (req.query.category) filter.category = String(req.query.category).slice(0, 100);
  const [books, total] = await Promise.all([
    Book.find(filter).select(`${publicBookFields} reservedStock`).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Book.countDocuments(filter)
  ]);
  res.json({
    books: books.map((book) => {
      const { reservedStock = 0, ...publicBook } = book;
      publicBook.availableStock = Math.max(0, publicBook.stock - reservedStock);
      return publicBook;
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
};

exports.getBook = async (req, res) => {
  const book = await Book.findOne({ slug: req.params.slug, status: 'published' }).select(`${publicBookFields} reservedStock`).lean();
  if (!book) throw Object.assign(new Error('Book not found'), { statusCode: 404 });
  const { reservedStock = 0, ...publicBook } = book;
  publicBook.availableStock = Math.max(0, publicBook.stock - reservedStock);
  res.json({ book: publicBook });
};

exports.listAdminBooks = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: pattern }, { slug: pattern }, { sku: pattern }];
  }
  const [books, total] = await Promise.all([
    Book.find(filter).select('+digitalFileUrl').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Book.countDocuments(filter)
  ]);
  res.json({ books, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

const bookInput = (body) => {
  const fields = ['title', 'slug', 'author', 'description', 'language', 'isbn', 'category', 'coverImage', 'productType', 'pricePaise', 'salePricePaise', 'stock', 'sku', 'shippingWeightGrams', 'digitalFileUrl', 'status', 'seoTitle', 'seoDescription'];
  const input = {};
  fields.forEach((field) => {
    if (body[field] !== undefined) input[field] = body[field];
  });
  if (input.slug !== undefined) input.slug = require('../utils/slugify')(input.slug);
  for (const field of ['pricePaise', 'salePricePaise', 'stock', 'shippingWeightGrams']) {
    if (input[field] != null) {
      const value = Number(input[field]);
      if (!Number.isSafeInteger(value) || value < (field === 'pricePaise' || field === 'salePricePaise' ? 1 : 0)) {
        throw Object.assign(new Error(`${field} must be a valid whole number`), { statusCode: 400 });
      }
      input[field] = value;
    }
  }
  if (input.salePricePaise != null && input.pricePaise != null && input.salePricePaise > input.pricePaise) {
    throw Object.assign(new Error('Sale price cannot exceed the regular price'), { statusCode: 400 });
  }
  if (input.productType === 'digital' && Number(input.stock || 0) !== 0) {
    throw Object.assign(new Error('Digital books do not use physical stock counts'), { statusCode: 400 });
  }
  return input;
};

const parseBookBody = (body) => {
  if (typeof body.book !== 'string') return body;
  try {
    return JSON.parse(body.book);
  } catch {
    throw Object.assign(new Error('Book details must be valid JSON'), { statusCode: 400 });
  }
};

const assertBookUniqueness = async (input, excludedId) => {
  if (input.slug) {
    const filter = { slug: input.slug };
    if (excludedId) filter._id = { $ne: excludedId };
    if (await Book.exists(filter)) throw Object.assign(new Error('A book with that slug already exists'), { statusCode: 409 });
  }
  if (input.sku) {
    const filter = { sku: input.sku };
    if (excludedId) filter._id = { $ne: excludedId };
    if (await Book.exists(filter)) throw Object.assign(new Error('A book with that SKU already exists'), { statusCode: 409 });
  }
};

exports.createBook = async (req, res) => {
  const input = bookInput(parseBookBody(req.body));
  if (req.file) input.coverImage = `/uploads/${req.file.filename}`;
  if (!input.slug) input.slug = require('../utils/slugify')(input.title);
  await assertBookUniqueness(input);
  input.editor = req.user._id;
  const book = await Book.create(input);
  await writeAuditLog(req, 'book.create', 'book', book._id, `Book "${book.title}" created`);
  res.status(201).json({ book: book.toObject({ transform: (_doc, value) => { delete value.digitalFileUrl; return value; } }) });
};

exports.updateBook = async (req, res) => {
  const input = bookInput(parseBookBody(req.body));
  if (req.file) input.coverImage = `/uploads/${req.file.filename}`;
  input.editor = req.user._id;
  await assertBookUniqueness(input, req.params.id);
  const before = await Book.findById(req.params.id);
  if (!before) throw Object.assign(new Error('Book not found'), { statusCode: 404 });
  if (before.reservedStock > 0 && input.productType === 'digital') {
    throw Object.assign(new Error('A book with reserved physical stock cannot be changed to digital'), { statusCode: 409 });
  }
  const book = await Book.findByIdAndUpdate(req.params.id, { $set: input }, { new: true, runValidators: true }).select('+digitalFileUrl');
  await writeAuditLog(req, 'book.update', 'book', book._id, `Book "${book.title}" updated`);
  res.json({ book: book.toObject({ transform: (_doc, value) => { delete value.digitalFileUrl; return value; } }) });
};

exports.setBookStatus = async (req, res) => {
  const status = req.body.status;
  if (!['draft', 'published', 'archived'].includes(status)) throw Object.assign(new Error('Invalid book status'), { statusCode: 400 });
  const book = await Book.findByIdAndUpdate(req.params.id, { $set: { status, editor: req.user._id } }, { new: true, runValidators: true });
  if (!book) throw Object.assign(new Error('Book not found'), { statusCode: 404 });
  await writeAuditLog(req, `book.${status}`, 'book', book._id, `Book "${book.title}" set to ${status}`);
  res.json({ book });
};

exports.createOrder = async (req, res) => {
  if (req.body.policyAccepted !== true) throw Object.assign(new Error('You must review and accept the store policies before checkout'), { statusCode: 400 });
  const settings = await getCheckoutSettings();
  const { keyId, razorpay } = getProvider();
  const items = await orderItemsFrom(req.body.items);
  const hasPhysicalItems = items.some((item) => item.productType === 'physical');
  const shippingAddress = hasPhysicalItems ? normalizeAddress(req.body.shippingAddress) : null;
  const customerName = String(req.body.customerName || req.user.name || '').trim().slice(0, 100);
  const customerEmail = String(req.body.customerEmail || req.user.email || '').trim().toLowerCase().slice(0, 254);
  const customerPhone = String(req.body.customerPhone || req.user.mobile || '').trim().slice(0, 20);
  if (customerName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || !/^[0-9+\- ]{10,15}$/.test(customerPhone)) {
    throw Object.assign(new Error('A valid name, email and phone number are required'), { statusCode: 400 });
  }
  const subtotalPaise = items.reduce((total, item) => total + item.unitAmountPaise * item.quantity, 0);
  if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise < 1) {
    throw Object.assign(new Error('Order total is invalid'), { statusCode: 400 });
  }
  if (hasPhysicalItems && !Number.isInteger(settings.shippingFeePaise)) {
    throw Object.assign(new Error('Shipping fee is not configured'), { statusCode: 503 });
  }
  const shippingPaise = hasPhysicalItems ? settings.shippingFeePaise : 0;
  if (!Number.isInteger(shippingPaise) || shippingPaise < 0) throw Object.assign(new Error('Shipping fee is not configured'), { statusCode: 503 });
  const taxPaise = settings.taxTreatment === 'exclusive'
    ? Math.round(subtotalPaise * Number(settings.taxRateBasisPoints) / 10000)
    : 0;
  const amountPaise = subtotalPaise + shippingPaise + taxPaise;
  if (!Number.isSafeInteger(amountPaise) || amountPaise > 1000000000) {
    throw Object.assign(new Error('Order total exceeds the supported payment limit'), { statusCode: 400 });
  }
  const orderNumber = `MU-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const providerOrder = await razorpay.orders.create({ amount: amountPaise, currency: 'INR', receipt: orderNumber });
  let order;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const reserved = await reserveStock(items, session);
      [order] = await BookOrder.create([{
        orderNumber,
        user: req.user._id,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        items,
        subtotalPaise,
        shippingPaise,
        taxPaise,
        amountPaise,
        policyAcceptedAt: new Date(),
        policyLinks: {
          privacy: settings.privacyPolicyUrl,
          shipping: settings.shippingPolicyUrl,
          returns: settings.returnPolicyUrl
        },
        razorpayOrderId: providerOrder.id,
        stockReserved: reserved.length > 0,
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        createdBy: req.user._id
      }], { session });
      await AuditLog.create([{
        actor: req.user._id,
        action: 'order.create',
        entityType: 'book-order',
        entityId: String(order._id),
        summary: `Book order ${order.orderNumber} created`
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  res.status(201).json({
    keyId,
    orderId: providerOrder.id,
    amount: providerOrder.amount,
    currency: providerOrder.currency,
    localOrderId: order._id,
    orderNumber: order.orderNumber,
    itemSubtotalPaise: subtotalPaise,
    shippingPaise,
    taxPaise,
    taxTreatment: settings.taxTreatment,
    policies: {
      privacy: settings.privacyPolicyUrl,
      shipping: settings.shippingPolicyUrl,
      returns: settings.returnPolicyUrl
    }
  });
};

exports.verifyOrderPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) throw Object.assign(new Error('Payment verification fields are required'), { statusCode: 400 });
  const { razorpay } = getProvider();
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const order = await BookOrder.findOne({ _id: req.params.id, user: req.user._id, razorpayOrderId });
  if (!order) throw Object.assign(new Error('Book order not found'), { statusCode: 404 });
  const expected = crypto.createHmac('sha256', secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
  const supplied = Buffer.from(String(razorpaySignature));
  const calculated = Buffer.from(expected);
  if (supplied.length !== calculated.length || !crypto.timingSafeEqual(calculated, supplied)) {
    throw Object.assign(new Error('Payment signature verification failed'), { statusCode: 400 });
  }
  const payment = await razorpay.payments.fetch(razorpayPaymentId);
  if (payment.order_id !== razorpayOrderId || payment.status !== 'captured' || payment.amount !== order.amountPaise || payment.currency !== order.currency) {
    throw Object.assign(new Error('Captured payment does not match the book order'), { statusCode: 400 });
  }
  const paidOrder = await markOrderPaid(order._id, payment);
  await writeAuditLog(req, 'order.payment_verified', 'book-order', paidOrder._id, `Payment verified for order ${paidOrder.orderNumber}`);
  res.json({ order: { id: paidOrder._id, orderNumber: paidOrder.orderNumber, paymentStatus: paidOrder.paymentStatus, fulfillmentStatus: paidOrder.fulfillmentStatus } });
};

exports.listOrders = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const filter = {};
  if (req.query.paymentStatus) filter.paymentStatus = String(req.query.paymentStatus);
  if (req.query.fulfillmentStatus) filter.fulfillmentStatus = String(req.query.fulfillmentStatus);
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ orderNumber: pattern }, { customerEmail: pattern }, { customerName: pattern }];
  }
  const [orders, total] = await Promise.all([
    BookOrder.find(filter).populate('user', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    BookOrder.countDocuments(filter)
  ]);
  res.json({ orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

exports.updateFulfillment = async (req, res) => {
  const allowed = ['processing', 'shipped', 'delivered'];
  if (!allowed.includes(req.body.fulfillmentStatus)) throw Object.assign(new Error('Invalid fulfillment status'), { statusCode: 400 });
  const order = await BookOrder.findById(req.params.id);
  if (!order) throw Object.assign(new Error('Book order not found'), { statusCode: 404 });
  if (order.paymentStatus !== 'paid') {
    throw Object.assign(new Error('Only paid orders can be fulfilled'), { statusCode: 409 });
  }
  const transitions = { unfulfilled: ['processing'], processing: ['shipped', 'delivered'], shipped: ['delivered'], delivered: [] };
  if (order.fulfillmentStatus !== req.body.fulfillmentStatus && !transitions[order.fulfillmentStatus]?.includes(req.body.fulfillmentStatus)) {
    throw Object.assign(new Error('Invalid fulfillment status transition'), { statusCode: 409 });
  }
  order.fulfillmentStatus = req.body.fulfillmentStatus;
  await order.save();
  await writeAuditLog(req, 'order.fulfillment_update', 'book-order', order._id, `Order ${order.orderNumber} fulfillment set to ${order.fulfillmentStatus}`);
  res.json({ order });
};

exports.expirePendingOrders = async () => {
  const expired = await BookOrder.find({ paymentStatus: 'pending', stockReserved: true, reservationExpiresAt: { $lte: new Date() } }).select('_id items');
  for (const candidate of expired) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await BookOrder.findOne({ _id: candidate._id, paymentStatus: 'pending', stockReserved: true }).session(session);
        if (!order) return;
        for (const item of order.items.filter((entry) => entry.productType === 'physical')) {
          const result = await Book.updateOne(
            { _id: item.book, reservedStock: { $gte: item.quantity } },
            { $inc: { reservedStock: -item.quantity } },
            { session }
          );
          if (result.modifiedCount !== 1) throw new Error(`Could not release reserved inventory for order ${order.orderNumber}`);
        }
        order.paymentStatus = 'cancelled';
        order.fulfillmentStatus = 'cancelled';
        order.stockReserved = false;
        order.reservationExpiresAt = null;
        await order.save({ session });
        await AuditLog.create([{ source: 'system', action: 'order.expired', entityType: 'book-order', entityId: String(order._id), summary: `Unpaid order ${order.orderNumber} expired` }], { session });
      });
    } finally {
      await session.endSession();
    }
  }
};

exports.webhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId || !keyId.startsWith('rzp_test_') || !process.env.RAZORPAY_KEY_SECRET || !secret) {
    throw Object.assign(new Error('Book payment webhook requires Razorpay test credentials'), { statusCode: 503 });
  }
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) throw Object.assign(new Error('Webhook signature is required'), { statusCode: 400 });
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const supplied = Buffer.from(String(signature));
  const calculated = Buffer.from(expected);
  if (supplied.length !== calculated.length || !crypto.timingSafeEqual(calculated, supplied)) {
    throw Object.assign(new Error('Webhook signature verification failed'), { statusCode: 400 });
  }
  const event = JSON.parse(rawBody.toString('utf8'));
  const payment = event.payload?.payment?.entity;
  if (event.event === 'payment.captured' && payment?.order_id) {
    const order = await BookOrder.findOne({ razorpayOrderId: payment.order_id });
    if (!order) throw Object.assign(new Error('Book order not found for payment'), { statusCode: 404 });
    if (payment.amount !== order.amountPaise || payment.currency !== order.currency) {
      throw Object.assign(new Error('Captured payment does not match the book order'), { statusCode: 400 });
    }
    const paidOrder = await markOrderPaid(order._id, payment);
    await AuditLog.create({ source: 'system', action: 'order.payment_verified', entityType: 'book-order', entityId: String(paidOrder._id), summary: `Webhook verified payment for order ${paidOrder.orderNumber}` });
  } else if (event.event === 'payment.failed' && payment?.order_id) {
    await markOrderFailed(payment.order_id, payment.id || '');
  }
  res.json({ received: true });
};
