const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const { test } = require('node:test');

const books = new Map();
const orders = new Map();
const auditRecords = [];
let providerOrderNumber = 0;
let paymentStatus = 'captured';
const validBookId = '507f1f77bcf86cd799439011';

const fakeSession = () => ({
  async withTransaction(callback) { return callback(); },
  async endSession() {}
});
const fakeMongoose = {
  isValidObjectId: (value) => /^[a-f\d]{24}$/i.test(value),
  async startSession() { return fakeSession(); }
};

const Book = {
  find(filter) {
    const matches = [...books.values()].filter((book) => filter.status !== 'published' || book.status === 'published');
    return {
      select() { return this; },
      lean: async () => matches
    };
  },
  async updateOne(filter, update) {
    const book = books.get(String(filter._id));
    if (!book) return { modifiedCount: 0 };
    const increment = update.$inc || {};
    if (increment.reservedStock > 0) {
      const available = book.stock - book.reservedStock;
      if (available < increment.reservedStock) return { modifiedCount: 0 };
      book.reservedStock += increment.reservedStock;
      return { modifiedCount: 1 };
    }
    if (increment.stock < 0 && increment.reservedStock < 0) {
      const quantity = -increment.stock;
      if (book.stock < quantity || book.reservedStock < quantity) return { modifiedCount: 0 };
      book.stock -= quantity;
      book.reservedStock -= quantity;
      return { modifiedCount: 1 };
    }
    if (increment.reservedStock < 0) {
      const quantity = -increment.reservedStock;
      if (book.reservedStock < quantity) return { modifiedCount: 0 };
      book.reservedStock -= quantity;
      return { modifiedCount: 1 };
    }
    return { modifiedCount: 0 };
  }
};

const createOrderRecord = (record) => ({
  paymentStatus: 'pending',
  fulfillmentStatus: 'unfulfilled',
  currency: 'INR',
  ...record,
  _id: record._id || `local-order-${orders.size + 1}`,
  async save() { orders.set(String(this._id), this); return this; }
});

const BookOrder = {
  async create(records) {
    const created = records.map(createOrderRecord);
    created.forEach((order) => orders.set(String(order._id), order));
    return created;
  },
  findById(id) {
    return { session: async () => orders.get(String(id)) || null };
  },
  findOne(filter) {
    const lookup = () => [...orders.values()].find((order) => Object.entries(filter).every(([key, value]) => String(order[key]) === String(value))) || null;
    return {
      session: async () => lookup(),
      then(resolve, reject) { return Promise.resolve(lookup()).then(resolve, reject); }
    };
  }
};

const WebsiteSettings = {
  findOne() {
    return {
      select() { return this; },
      lean: async () => ({
        store: {
          checkoutEnabled: true,
          shippingFeePaise: 500,
          taxTreatment: 'exclusive',
          taxRateBasisPoints: 900,
          privacyPolicyUrl: '/privacy-policy',
          shippingPolicyUrl: '/shipping-policy',
          returnPolicyUrl: '/returns'
        }
      })
    };
  }
};

class FakeRazorpay {
  constructor() {
    this.orders = {
      create: async ({ amount, currency }) => {
        providerOrderNumber += 1;
        return { id: `provider-order-${providerOrderNumber}`, amount, currency };
      }
    };
    this.payments = {
      fetch: async (id) => {
        const order = [...orders.values()].find((candidate) => candidate.razorpayPaymentId === id);
        const matchingOrder = order || [...orders.values()].find((candidate) => candidate.razorpayOrderId === activeProviderOrderId);
        return {
          id,
          order_id: activeProviderOrderId,
          status: paymentStatus,
          amount: matchingOrder?.amountPaise || 0,
          currency: 'INR'
        };
      }
    };
  }
}

let activeProviderOrderId = '';
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith('storeController.js')) {
    if (request === 'mongoose') return fakeMongoose;
    if (request === 'razorpay') return FakeRazorpay;
    if (request === '../models/Book') return Book;
    if (request === '../models/BookOrder') return BookOrder;
    if (request === '../models/WebsiteSettings') return WebsiteSettings;
    if (request === '../models/AuditLog') return { create: async (record) => auditRecords.push(...(Array.isArray(record) ? record : [record])) };
    if (request === '../utils/writeAuditLog') return async () => {};
  }
  return originalLoad.call(this, request, parent, isMain);
};
const controller = require('../controllers/storeController');
Module._load = originalLoad;

const sign = (secret, value) => crypto.createHmac('sha256', secret).update(value).digest('hex');
const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});
const user = { _id: 'user-test-1', role: 'user', name: 'Test User', email: 'test@example.com', mobile: '9876543210' };
const shippingAddress = { line1: '12 Test Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001', country: 'India' };

test('store checkout computes server price, reserves stock, verifies captures and handles duplicate webhooks', async () => {
  const originalEnvironment = {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
  };
  process.env.RAZORPAY_KEY_ID = 'rzp_test_id';
  process.env.RAZORPAY_KEY_SECRET = 'test-secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-secret';
  books.clear();
  orders.clear();
  auditRecords.length = 0;
  providerOrderNumber = 0;
  paymentStatus = 'captured';
  books.set(validBookId, {
    _id: validBookId,
    title: 'Test book',
    sku: 'TEST-1',
    productType: 'physical',
    status: 'published',
    pricePaise: 1000,
    salePricePaise: null,
    stock: 5,
    reservedStock: 0
  });
  try {
    const orderResponse = makeResponse();
    await controller.createOrder({
      user,
      body: {
        policyAccepted: true,
        items: [{ bookId: validBookId, quantity: 2 }],
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.mobile,
        shippingAddress
      }
    }, orderResponse);
    assert.equal(orderResponse.statusCode, 201);
    assert.equal(orderResponse.body.amount, 2680);
    assert.equal(books.get(validBookId).reservedStock, 2);
    const order = orders.get(String(orderResponse.body.localOrderId));
    assert.equal(order.subtotalPaise, 2000);
    assert.equal(order.shippingPaise, 500);
    assert.equal(order.taxPaise, 180);
    assert.equal(order.policyLinks.privacy, '/privacy-policy');
    assert.ok(order.policyAcceptedAt instanceof Date);
    assert.equal(auditRecords.length, 1);
    activeProviderOrderId = order.razorpayOrderId;
    const paymentId = 'payment-captured-1';
    const verificationBody = {
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: paymentId
    };
    verificationBody.razorpaySignature = sign('test-secret', `${verificationBody.razorpayOrderId}|${paymentId}`);
    const invalidBody = { ...verificationBody, razorpaySignature: 'invalid' };
    await assert.rejects(
      controller.verifyOrderPayment({ params: { id: order._id }, user, body: invalidBody }, makeResponse()),
      { statusCode: 400 }
    );
    assert.equal(order.paymentStatus, 'pending');

    const verifiedResponse = makeResponse();
    await controller.verifyOrderPayment({ params: { id: order._id }, user, body: verificationBody }, verifiedResponse);
    assert.equal(verifiedResponse.body.order.paymentStatus, 'paid');
    assert.equal(books.get(validBookId).stock, 3);
    assert.equal(books.get(validBookId).reservedStock, 0);

    const webhookEvent = {
      event: 'payment.captured',
      payload: { payment: { entity: {
        id: paymentId,
        order_id: order.razorpayOrderId,
        amount: order.amountPaise,
        currency: order.currency
      } } }
    };
    const rawBody = Buffer.from(JSON.stringify(webhookEvent));
    const webhookSignature = sign('webhook-secret', rawBody);
    await assert.rejects(
      controller.webhook({ headers: { 'x-razorpay-signature': 'invalid' }, rawBody }, makeResponse()),
      { statusCode: 400 }
    );
    const firstWebhook = makeResponse();
    await controller.webhook({ headers: { 'x-razorpay-signature': webhookSignature }, rawBody }, firstWebhook);
    const repeatedWebhook = makeResponse();
    await controller.webhook({ headers: { 'x-razorpay-signature': webhookSignature }, rawBody }, repeatedWebhook);
    assert.deepEqual(firstWebhook.body, { received: true });
    assert.deepEqual(repeatedWebhook.body, { received: true });
    assert.equal(books.get(validBookId).stock, 3);

    const failedOrderResponse = makeResponse();
    await controller.createOrder({
      user,
      body: {
        policyAccepted: true,
        items: [{ bookId: validBookId, quantity: 1 }],
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.mobile,
        shippingAddress
      }
    }, failedOrderResponse);
    const failedOrder = orders.get(String(failedOrderResponse.body.localOrderId));
    assert.equal(books.get(validBookId).reservedStock, 1);
    const failureEvent = {
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'payment-failed-1', order_id: failedOrder.razorpayOrderId } } }
    };
    const failureRawBody = Buffer.from(JSON.stringify(failureEvent));
    const failureResponse = makeResponse();
    await controller.webhook({
      headers: { 'x-razorpay-signature': sign('webhook-secret', failureRawBody) },
      rawBody: failureRawBody
    }, failureResponse);
    assert.equal(failedOrder.paymentStatus, 'failed');
    assert.equal(failedOrder.fulfillmentStatus, 'cancelled');
    assert.equal(failedOrder.stockReserved, false);
    assert.equal(books.get(validBookId).reservedStock, 0);
  } finally {
    if (originalEnvironment.keyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalEnvironment.keyId;
    if (originalEnvironment.keySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalEnvironment.keySecret;
    if (originalEnvironment.webhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = originalEnvironment.webhookSecret;
  }
});
