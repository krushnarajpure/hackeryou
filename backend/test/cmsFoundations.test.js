const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const Article = require('../models/Article');
const Revision = require('../models/Revision');
const AuditLog = require('../models/AuditLog');
const { createArticle, updateArticle } = require('../controllers/articleController');
const { createOrder, webhook } = require('../controllers/storeController');
const analyticsController = require('../controllers/analyticsController');
const { hasPermission, requirePermission } = require('../middleware/permissionMiddleware');
const { publishDueArticles } = require('../utils/articleScheduler');
const normalizeFeatureCards = require('../utils/normalizeBusinessFeatureCards');

test('homepage feature cards accept internal destinations and reject unsafe or duplicate values', () => {
  const [feature] = normalizeFeatureCards([{
    key: 'licenses-registration',
    title: 'Licenses & Registration',
    subtitle: 'Documents, Permits & Compliance',
    icon: 'FileCheck',
    path: '/business-licenses',
    image: '/uploads/licenses.webp',
    order: 1
  }]);
  assert.equal(feature.path, '/business-licenses');
  assert.equal(feature.isActive, true);
  assert.throws(() => normalizeFeatureCards([{ ...feature, path: '//outside.example/path' }]), { statusCode: 400 });
  assert.throws(() => normalizeFeatureCards([{ ...feature, icon: 'UnknownIcon' }]), { statusCode: 400 });
  assert.throws(() => normalizeFeatureCards([feature, feature]), { statusCode: 400 });
});

test('role permissions keep content editors away from publishing and store managers scoped to orders', () => {
  assert.equal(hasPermission('content_editor', 'articles:write'), true);
  assert.equal(hasPermission('content_editor', 'articles:publish'), false);
  assert.equal(hasPermission('store_manager', 'orders:read'), true);
  assert.equal(hasPermission('store_manager', 'analytics:read'), false);
});

test('permission middleware rejects missing permission without calling next', () => {
  let nextCalled = false;
  const response = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  requirePermission('store:write')({ user: { role: 'analyst' } }, response, () => { nextCalled = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('content editors cannot publish or schedule articles at creation or edit time', async () => {
  await assert.rejects(
    createArticle({ user: { _id: 'editor-id', role: 'content_editor' }, body: { title: 'Draft', isPublished: true } }, {}),
    { statusCode: 403 }
  );

  const originalFindById = Article.findById;
  Article.findById = () => ({
    lean: async () => ({
      _id: 'article-id',
      title: 'Existing draft',
      slug: 'existing-draft',
      isPublished: false,
      publicationDate: null,
      scheduledAt: null
    })
  });
  try {
    await assert.rejects(
      updateArticle({
        user: { _id: 'editor-id', role: 'content_editor' },
        params: { id: 'article-id' },
        body: { isPublished: true }
      }, {}),
      { statusCode: 403 }
    );
  } finally {
    Article.findById = originalFindById;
  }
});

test('book checkout refuses to proceed unless policies were accepted', async () => {
  await assert.rejects(
    createOrder({ body: { policyAccepted: false } }, {}),
    { statusCode: 400 }
  );
});

test('book payment webhook rejects live gateway credentials', async () => {
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_KEY_ID = 'rzp_live_not-usable';
  process.env.RAZORPAY_KEY_SECRET = 'test-secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
  try {
    await assert.rejects(webhook({ headers: {}, body: {} }, {}), { statusCode: 503 });
  } finally {
    if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalKeyId;
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
    if (originalWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
  }
});

test('analytics rejects invalid ranges before querying stored data', async () => {
  await assert.rejects(
    analyticsController.overview({ query: { from: 'not-a-date' } }, {}),
    { statusCode: 400 }
  );
});

test('scheduled publishing only updates still-due, unarchived drafts and records both histories', async () => {
  const originals = {
    find: Article.find,
    findOneAndUpdate: Article.findOneAndUpdate,
    revisionCreate: Revision.create,
    auditCreate: AuditLog.create
  };
  const now = new Date('2026-03-10T12:00:00Z');
  const dueArticle = { _id: 'due-article', title: 'Scheduled article', scheduledAt: new Date('2026-03-10T11:00:00Z') };
  const updatedArticle = { ...dueArticle, isPublished: true, publicationDate: dueArticle.scheduledAt };
  let candidateFilter;
  let updateFilter;
  let updateValues;
  let revisionCount = 0;
  let auditCount = 0;
  Article.find = (filter) => {
    candidateFilter = filter;
    return {
      select() { return this; },
      limit() { return this; },
      lean: async () => [dueArticle]
    };
  };
  Article.findOneAndUpdate = async (filter, update) => {
    updateFilter = filter;
    updateValues = update;
    return updatedArticle;
  };
  Revision.create = async () => { revisionCount += 1; };
  AuditLog.create = async () => { auditCount += 1; };
  try {
    const count = await publishDueArticles(now);
    assert.equal(count, 1);
    assert.deepEqual(candidateFilter, {
      isPublished: false,
      archivedAt: null,
      scheduledAt: { $lte: now }
    });
    assert.equal(updateFilter._id, dueArticle._id);
    assert.deepEqual(updateValues.$set, { isPublished: true, publicationDate: dueArticle.scheduledAt });
    assert.deepEqual(updateValues.$unset, { scheduledAt: '' });
    assert.equal(revisionCount, 1);
    assert.equal(auditCount, 1);
  } finally {
    Article.find = originals.find;
    Article.findOneAndUpdate = originals.findOneAndUpdate;
    Revision.create = originals.revisionCreate;
    AuditLog.create = originals.auditCreate;
  }
});

test('CMS index changes require an explicit backup confirmation before connecting', () => {
  const scripts = ['cms-indexes-up.js', 'cms-indexes-down.js'];
  const scriptDirectory = path.resolve(__dirname, '..', 'scripts');
  for (const script of scripts) {
    const result = spawnSync(process.execPath, [path.join(scriptDirectory, script)], {
      encoding: 'utf8',
      timeout: 10000
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /export a database backup.*--confirm-backup/i);
  }
});
