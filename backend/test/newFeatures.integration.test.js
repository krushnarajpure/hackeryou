const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const Article = require('../models/Article');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const WebsiteVisitor = require('../models/WebsiteVisitor');
const WebsiteVisitorDay = require('../models/WebsiteVisitorDay');
const WebsitePageView = require('../models/WebsitePageView');
const { errorHandler } = require('../middleware/errorMiddleware');

test('comment and analytics APIs validate submissions and enforce authenticated admin access', async () => {
  const originals = {
    articleFindOne: Article.findOne,
    articleAggregate: Article.aggregate,
    articleUpdateOne: Article.updateOne,
    auditCreate: AuditLog.create,
    userFindById: User.findById,
    visitorUpdate: WebsiteVisitor.updateOne,
    visitorDayUpdate: WebsiteVisitorDay.updateOne,
    pageViewUpdate: WebsitePageView.updateOne,
    secret: process.env.JWT_SECRET
  };
  const submittedComments = [];
  const updates = [];
  const visitorWrites = [];
  const pageViewWrites = [];
  Article.findOne = async () => ({
    comments: submittedComments,
    save: async () => {}
  });
  Article.aggregate = async () => [{
    counts: [{ _id: 'pending', total: 1 }],
    comments: [],
    total: [{ value: 1 }]
  }];
  Article.updateOne = async (...args) => { updates.push(args); return { matchedCount: 1 }; };
  AuditLog.create = async (record) => record;
  User.findById = (id) => ({
    select: async () => ({ _id: id, role: globalThis.currentTestRole || 'admin', isActive: true })
  });
  WebsiteVisitor.updateOne = async (...args) => visitorWrites.push(args);
  WebsiteVisitorDay.updateOne = async () => {};
  WebsitePageView.updateOne = async (...args) => pageViewWrites.push(args);
  process.env.JWT_SECRET = 'integration-test-secret';

  const app = express();
  app.use(express.json());
  app.use('/api/articles', require('../routes/articleRoutes'));
  app.use('/api/admin', require('../routes/adminRoutes'));
  app.use('/api/analytics', require('../routes/analyticsRoutes'));
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const tokenFor = (role) => jwt.sign({ id: '64b000000000000000000001' }, process.env.JWT_SECRET, { expiresIn: '1h', header: { kid: role } });
  globalThis.currentTestRole = 'admin';

  try {
    const commentResponse = await fetch(`${baseUrl}/api/articles/published-article/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Integration User',
        email: 'integration@example.com',
        website: '',
        message: 'A valid integration test comment.'
      })
    });
    assert.equal(commentResponse.status, 201);
    assert.equal(submittedComments[0].status, 'pending');
    assert.equal(submittedComments[0].email, 'integration@example.com');

    const invalidComment = await fetch(`${baseUrl}/api/articles/published-article/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x', email: 'not-an-email', message: 'short' })
    });
    assert.equal(invalidComment.status, 400);

    const anonymousAdminRequest = await fetch(`${baseUrl}/api/admin/comments`);
    assert.equal(anonymousAdminRequest.status, 401);
    const anonymousAnalyticsRequest = await fetch(`${baseUrl}/api/analytics/overview`);
    assert.equal(anonymousAnalyticsRequest.status, 401);

    globalThis.currentTestRole = 'content_editor';
    const forbiddenAdminRequest = await fetch(`${baseUrl}/api/admin/comments`, {
      headers: { Authorization: `Bearer ${tokenFor('content_editor')}` }
    });
    assert.equal(forbiddenAdminRequest.status, 403);

    globalThis.currentTestRole = 'admin';
    const adminHeaders = { Authorization: `Bearer ${tokenFor('admin')}` };
    const commentsResponse = await fetch(`${baseUrl}/api/admin/comments`, { headers: adminHeaders });
    assert.equal(commentsResponse.status, 200);
    assert.equal((await commentsResponse.json()).counts.pending, 1);

    const articleId = '64b000000000000000000002';
    const commentId = '64b000000000000000000003';
    const moderateResponse = await fetch(`${baseUrl}/api/admin/comments/${articleId}/${commentId}`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' })
    });
    assert.equal(moderateResponse.status, 200);
    assert.deepEqual(updates[0][1].$set, {
      'comments.$.status': 'approved',
      'comments.$.isApproved': true
    });

    const rejectResponse = await fetch(`${baseUrl}/api/admin/comments/${articleId}/${commentId}`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' })
    });
    assert.equal(rejectResponse.status, 200);
    assert.deepEqual(updates[1][1].$set, {
      'comments.$.status': 'rejected',
      'comments.$.isApproved': false
    });

    const deleteResponse = await fetch(`${baseUrl}/api/admin/comments/${articleId}/${commentId}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(updates[2][1].$pull, { comments: { _id: commentId } });

    const visitorResponse = await fetch(`${baseUrl}/api/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: '4ff1d083-9c75-4ea6-9432-1c91a0b7ad05',
        path: '/articles/sample?private=value',
        title: 'Sample article'
      })
    });
    assert.equal(visitorResponse.status, 400);
    const validVisitorResponse = await fetch(`${baseUrl}/api/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: '4ff1d083-9c75-4ea6-9432-1c91a0b7ad05',
        path: '/articles/sample',
        title: 'Sample article'
      })
    });
    assert.equal(validVisitorResponse.status, 200);
    assert.notEqual(visitorWrites[0][0].visitorHash, '4ff1d083-9c75-4ea6-9432-1c91a0b7ad05');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    delete globalThis.currentTestRole;
    Article.findOne = originals.articleFindOne;
    Article.aggregate = originals.articleAggregate;
    Article.updateOne = originals.articleUpdateOne;
    AuditLog.create = originals.auditCreate;
    User.findById = originals.userFindById;
    WebsiteVisitor.updateOne = originals.visitorUpdate;
    WebsiteVisitorDay.updateOne = originals.visitorDayUpdate;
    WebsitePageView.updateOne = originals.pageViewUpdate;
    if (originals.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originals.secret;
  }
});
