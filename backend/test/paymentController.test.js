const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const { test } = require('node:test');

let payment;
let providerStatus;
let providerAmount;
let providerOrderId;
let createdOrder;
const promotions = new Map();

const Payment = {
  create: async (data) => (payment = {
    _id: 'payment-record-1',
    currency: 'INR',
    razorpayPaymentId: '',
    ...data
  }),
  findOne: async ({ razorpayOrderId }) =>
    payment?.razorpayOrderId === razorpayOrderId ? payment : null,
  findOneAndUpdate: async (filter, update) => {
    if (!payment || payment._id !== filter._id) return null;
    if (filter.status?.$ne === 'paid' && payment.status !== 'paid') {
      Object.assign(payment, update.$set);
      return payment;
    }
    if (filter.status === 'created' && payment.status === 'created') {
      Object.assign(payment, update.$set);
      return payment;
    }
    return null;
  },
  findById: async () => payment
};

const Promotion = {
  findOneAndUpdate: async (filter, update) => {
    const key = String(filter.payment);
    const current = promotions.get(key) || {};
    Object.assign(current, update.$set);
    promotions.set(key, current);
    return current;
  }
};

class FakeRazorpay {
  constructor() {
    this.orders = {
      create: async (data) => {
        createdOrder = data;
        return { id: 'order-test-1', amount: data.amount, currency: data.currency };
      }
    };
    this.payments = {
      fetch: async (id) => ({
        id,
        order_id: providerOrderId,
        status: providerStatus,
        amount: providerAmount,
        currency: 'INR'
      })
    };
  }
}

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith('paymentController.js')) {
    if (request === 'razorpay') return FakeRazorpay;
    if (request === '../models/Payment') return Payment;
    if (request === '../models/Promotion') return Promotion;
    if (request === '../models/Business') return { findById: async () => null };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const controller = require('../controllers/paymentController');
Module._load = originalLoad;

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const sign = (secret, value) =>
  crypto.createHmac('sha256', secret).update(value).digest('hex');

test('Razorpay orders require captured, matching payments and idempotent webhooks', async (t) => {
  const originalEnvironment = {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
  };
  process.env.RAZORPAY_KEY_ID = 'rzp_test_id';
  process.env.RAZORPAY_KEY_SECRET = 'test-secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-secret';
  providerStatus = 'authorized';
  providerAmount = 49900;
  providerOrderId = 'order-test-1';
  promotions.clear();

  try {
    const user = { _id: 'user-1', role: 'user' };
    const orderResponse = makeResponse();
    await controller.createOrder({ body: { packageType: 'business_promotion' }, user }, orderResponse);
    assert.equal(orderResponse.statusCode, 201);
    assert.equal(createdOrder.amount, 49900);
    assert.equal(payment.status, 'created');
    await t.test('order amount is selected server-side', () => {
      assert.equal(orderResponse.body.amount, 49900);
      assert.equal(orderResponse.body.currency, 'INR');
    });

    const verifyBody = {
      razorpayOrderId: 'order-test-1',
      razorpayPaymentId: 'razorpay-payment-1'
    };
    verifyBody.razorpaySignature = sign(
      'test-secret',
      `${verifyBody.razorpayOrderId}|${verifyBody.razorpayPaymentId}`
    );

    await assert.rejects(
      () => controller.verifyPayment({ body: verifyBody, user }, makeResponse()),
      (error) => error.statusCode === 400
    );
    assert.equal(payment.status, 'created');
    await t.test('authorized but uncaptured payments are rejected', () => {
      assert.equal(payment.status, 'created');
      assert.equal(promotions.size, 0);
    });

    providerStatus = 'captured';
    providerAmount = 49899;
    await assert.rejects(
      () => controller.verifyPayment({ body: verifyBody, user }, makeResponse()),
      (error) => error.statusCode === 400
    );
    providerAmount = 49900;
    providerOrderId = 'different-order';
    await assert.rejects(
      () => controller.verifyPayment({ body: verifyBody, user }, makeResponse()),
      (error) => error.statusCode === 400
    );
    providerOrderId = 'order-test-1';
    await t.test('capture amount and order must match', () => {
      assert.equal(payment.status, 'created');
      assert.equal(promotions.size, 0);
    });

    const verifiedResponse = makeResponse();
    await controller.verifyPayment({ body: verifyBody, user }, verifiedResponse);
    assert.equal(verifiedResponse.body.payment.status, 'paid');
    assert.equal(promotions.size, 1);
    await t.test('verified capture activates a promotion', () => {
      assert.equal(payment.status, 'paid');
      assert.equal(promotions.size, 1);
    });

    const event = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'razorpay-payment-1',
            order_id: 'order-test-1',
            amount: 49900,
            currency: 'INR'
          }
        }
      }
    };
    const rawBody = Buffer.from(JSON.stringify(event));
    const webhookSignature = sign('webhook-secret', rawBody);
    await assert.rejects(
      () => controller.webhook({
        headers: { 'x-razorpay-signature': 'invalid' },
        rawBody
      }, makeResponse()),
      (error) => error.statusCode === 400
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      const webhookResponse = makeResponse();
      await controller.webhook({
        headers: { 'x-razorpay-signature': webhookSignature },
        rawBody
      }, webhookResponse);
      assert.deepEqual(webhookResponse.body, { received: true });
    }
    assert.equal(payment.status, 'paid');
    assert.equal(promotions.size, 1);
    await t.test('duplicate captured webhooks do not duplicate promotions', () => {
      assert.equal(promotions.size, 1);
    });
  } finally {
    if (originalEnvironment.keyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalEnvironment.keyId;
    if (originalEnvironment.keySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalEnvironment.keySecret;
    if (originalEnvironment.webhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = originalEnvironment.webhookSecret;
  }
});
