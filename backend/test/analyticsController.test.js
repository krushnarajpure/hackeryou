const assert = require('node:assert/strict');
const { test } = require('node:test');
const WebsiteVisitor = require('../models/WebsiteVisitor');
const WebsiteVisitorDay = require('../models/WebsiteVisitorDay');
const WebsitePageView = require('../models/WebsitePageView');
const Article = require('../models/Article');
const ArticleAnalytics = require('../models/ArticleAnalytics');
const ArticleVisitor = require('../models/ArticleVisitor');
const Enquiry = require('../models/Enquiry');
const Payment = require('../models/Payment');
const BookOrder = require('../models/BookOrder');
const { overview, trackPageView } = require('../controllers/analyticsController');

test('page views hash anonymous browser IDs and aggregate page counts without storing query strings', async () => {
  const originals = {
    visitorUpdate: WebsiteVisitor.updateOne,
    visitorDayUpdate: WebsiteVisitorDay.updateOne,
    pageViewUpdate: WebsitePageView.updateOne,
    secret: process.env.JWT_SECRET
  };
  const visitorWrites = [];
  const visitorDayWrites = [];
  const pageViewWrites = [];
  WebsiteVisitor.updateOne = async (...args) => visitorWrites.push(args);
  WebsiteVisitorDay.updateOne = async (...args) => visitorDayWrites.push(args);
  WebsitePageView.updateOne = async (...args) => pageViewWrites.push(args);
  process.env.JWT_SECRET = 'analytics-test-secret';
  const request = {
    body: {
      visitorId: '4ff1d083-9c75-4ea6-9432-1c91a0b7ad05',
      path: '/articles/sample',
      title: 'Sample article'
    },
    get: () => 'Mozilla/5.0'
  };
  const response = { json(payload) { this.payload = payload; } };

  try {
    await trackPageView(request, response);
    const refreshResponse = { json(payload) { this.payload = payload; } };
    await trackPageView(request, refreshResponse);
    assert.deepEqual(refreshResponse.payload, { tracked: true });
  } finally {
    WebsiteVisitor.updateOne = originals.visitorUpdate;
    WebsiteVisitorDay.updateOne = originals.visitorDayUpdate;
    WebsitePageView.updateOne = originals.pageViewUpdate;
    if (originals.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originals.secret;
  }

  assert.deepEqual(response.payload, { tracked: true });
  assert.equal(visitorWrites[0][0].visitorHash.length, 64);
  assert.notEqual(visitorWrites[0][0].visitorHash, request.body.visitorId);
  assert.equal(visitorWrites[0][0].visitorHash, visitorDayWrites[0][0].visitorHash);
  assert.equal(visitorWrites[0][0].visitorHash, visitorWrites[1][0].visitorHash);
  assert.equal(visitorWrites[1][1].$setOnInsert.firstSeenAt instanceof Date, true);
  assert.equal(pageViewWrites[0][0].path, '/articles/sample');
  assert.equal(JSON.stringify(pageViewWrites[0]).includes('?'), false);
  assert.deepEqual(pageViewWrites[0][1].$inc, { pageViews: 1 });
});

test('admin page requests are excluded from public visitor totals', async () => {
  const originalUpdate = WebsiteVisitor.updateOne;
  WebsiteVisitor.updateOne = () => { throw new Error('Admin pageviews must not be stored'); };
  const response = { json(payload) { this.payload = payload; } };

  try {
    await trackPageView({
      body: { visitorId: '4ff1d083-9c75-4ea6-9432-1c91a0b7ad05', path: '/admin' },
      get: () => 'Mozilla/5.0'
    }, response);
  } finally {
    WebsiteVisitor.updateOne = originalUpdate;
  }

  assert.deepEqual(response.payload, { tracked: false });
});

test('analytics overview reports stored totals and daily unique visitors without synthetic values', async () => {
  const originals = {
    articleCount: Article.countDocuments,
    articleAggregate: Article.aggregate,
    articleAnalyticsAggregate: ArticleAnalytics.aggregate,
    articleVisitorAggregate: ArticleVisitor.aggregate,
    enquiryCount: Enquiry.countDocuments,
    paymentAggregate: Payment.aggregate,
    bookOrderAggregate: BookOrder.aggregate,
    visitorCount: WebsiteVisitor.countDocuments,
    visitorDays: WebsiteVisitorDay.aggregate,
    pageMetrics: WebsitePageView.aggregate
  };
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  const yesterdayDate = new Date(`${today}T00:00:00Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  Article.countDocuments = async () => 0;
  Article.aggregate = async () => [{ total: 3 }];
  ArticleAnalytics.aggregate = async (pipeline) => {
    if (pipeline[0].$group) return [{ value: 12 }];
    if (pipeline[0].$sort) return [{ articleId: 'article-id', title: 'Top article', totalViews: 12 }];
    return [{ _id: 'Business', views: 12 }];
  };
  ArticleVisitor.aggregate = async (pipeline) => (
    pipeline[0].$match
      ? []
      : [{ value: 2 }]
  );
  Enquiry.countDocuments = async () => 0;
  Payment.aggregate = async () => [];
  BookOrder.aggregate = async () => [];
  WebsiteVisitor.countDocuments = async () => 42;
  WebsiteVisitorDay.aggregate = async () => [
    { _id: yesterday, visitors: 3 },
    { _id: today, visitors: 2 }
  ];
  WebsitePageView.aggregate = async () => [{
    totals: [{ total: 100 }],
    daily: [{ _id: today, pageViews: 10 }],
    topPages: [{ _id: '/', title: 'Home', pageViews: 50 }]
  }];
  const response = { json(payload) { this.payload = payload; } };

  try {
    await overview({ query: {} }, response);
  } finally {
    Article.countDocuments = originals.articleCount;
    Article.aggregate = originals.articleAggregate;
    ArticleAnalytics.aggregate = originals.articleAnalyticsAggregate;
    ArticleVisitor.aggregate = originals.articleVisitorAggregate;
    Enquiry.countDocuments = originals.enquiryCount;
    Payment.aggregate = originals.paymentAggregate;
    BookOrder.aggregate = originals.bookOrderAggregate;
    WebsiteVisitor.countDocuments = originals.visitorCount;
    WebsiteVisitorDay.aggregate = originals.visitorDays;
    WebsitePageView.aggregate = originals.pageMetrics;
  }

  assert.equal(response.payload.metrics.totalVisitors, 42);
  assert.equal(response.payload.metrics.totalPageViews, 100);
  assert.equal(response.payload.metrics.todayVisitors, 2);
  assert.equal(response.payload.metrics.todayPageViews, 10);
  assert.equal(response.payload.metrics.last7DaysVisitors, 5);
  assert.equal(response.payload.metrics.last30DaysVisitors, 5);
  assert.equal(response.payload.metrics.totalComments, 3);
  assert.equal(response.payload.charts.dailyVisitors.length, 30);
  assert.deepEqual(response.payload.charts.topPages, [{ path: '/', title: 'Home', pageViews: 50 }]);
  assert.equal(response.payload.charts.topArticles[0].title, 'Top article');
});
