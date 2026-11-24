const assert = require('node:assert/strict');
const { test } = require('node:test');
const Article = require('../models/Article');
const ArticleAnalytics = require('../models/ArticleAnalytics');
const ArticleVisitor = require('../models/ArticleVisitor');
const { getArticles, getArticleSuggestions, getPopularArticles, getRelatedArticles, trackArticleView } = require('../controllers/articleController');

function query(records) {
  return {
    populate() { return this; },
    select() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(records); },
    then(resolve, reject) { return Promise.resolve(records).then(resolve, reject); }
  };
}

test('category archives include articles assigned through additional categories', async () => {
  const Category = require('../models/Category');
  const originalFind = Article.find;
  const originalCountDocuments = Article.countDocuments;
  const originalCategoryFindOne = Category.findOne;
  const filters = [];
  Article.find = (filter) => {
    filters.push(filter);
    return query([]);
  };
  Article.countDocuments = (filter) => {
    filters.push(filter);
    return Promise.resolve(1);
  };
  Category.findOne = async () => ({ name: 'स्वतःची डेव्हलोपमेंट' });
  const response = {
    json(payload) { this.payload = payload; }
  };

  try {
    await getArticles({ query: { category: 'personality-development', page: '1', limit: '12' } }, response);
  } finally {
    Article.find = originalFind;
    Article.countDocuments = originalCountDocuments;
    Category.findOne = originalCategoryFindOne;
  }

  assert.deepEqual(filters[0].$or, [
    { category: 'स्वतःची डेव्हलोपमेंट' },
    { additionalCategories: 'स्वतःची डेव्हलोपमेंट' }
  ]);
  assert.equal(response.payload.categoryName, 'स्वतःची डेव्हलोपमेंट');
  assert.equal(response.payload.pagination.total, 1);
});

test('related articles prefer the current article specific category membership', async () => {
  const originalFindOne = Article.findOne;
  const originalFind = Article.find;
  const filters = [];
  Article.findOne = async () => ({
    slug: 'organic-fertilizer',
    category: 'उद्योजकता',
    additionalCategories: ['शेती उद्योग']
  });
  Article.find = (filter) => {
    filters.push(filter);
    return query([{ slug: 'another-farming-article' }]);
  };
  const response = {
    json(payload) { this.payload = payload; }
  };

  try {
    await getRelatedArticles({ params: { slug: 'organic-fertilizer' }, query: { limit: '3' } }, response);
  } finally {
    Article.findOne = originalFindOne;
    Article.find = originalFind;
  }

  assert.deepEqual(filters[0], {
    isPublished: true,
    slug: { $ne: 'organic-fertilizer' },
    $or: [
      { category: { $in: ['शेती उद्योग'] } },
      { additionalCategories: { $in: ['शेती उद्योग'] } }
    ]
  });
  assert.equal(response.payload.articles[0].slug, 'another-farming-article');
});

test('article suggestions match a literal title prefix and include published articles only', async () => {
  const originalFind = Article.find;
  const originalCountDocuments = Article.countDocuments;
  const filters = [];
  Article.find = (filter) => {
    filters.push(filter);
    return query([{ slug: 'k-dot-business-idea', title: 'K. Business Idea' }]);
  };
  Article.countDocuments = (filter) => {
    filters.push(filter);
    return Promise.resolve(1);
  };
  const response = {
    json(payload) { this.payload = payload; }
  };

  try {
    await getArticleSuggestions({ query: { prefix: 'k.', limit: '50' } }, response);
  } finally {
    Article.find = originalFind;
    Article.countDocuments = originalCountDocuments;
  }

  assert.equal(filters[0].isPublished, true);
  assert.equal(filters[0].title.source, '^k\\.');
  assert.equal(filters[0].title.flags, 'i');
  assert.deepEqual(filters[1], filters[0]);
  assert.equal(response.payload.articles[0].slug, 'k-dot-business-idea');
  assert.equal(response.payload.pagination.total, 1);
  assert.equal(response.payload.matchMode, 'title-prefix');
});

test('article suggestions fall back to relevant published content when no title starts with the query', async () => {
  const originalFind = Article.find;
  const originalCountDocuments = Article.countDocuments;
  const filters = [];
  Article.find = (filter) => {
    filters.push(filter);
    return query(filters.length === 1 ? [] : [{ slug: 'startup-india-seed-fund-scheme' }]);
  };
  Article.countDocuments = (filter) => {
    filters.push(filter);
    return Promise.resolve(filters.length === 2 ? 0 : 1);
  };
  const response = {
    json(payload) { this.payload = payload; }
  };

  try {
    await getArticleSuggestions({ query: { prefix: 'k', limit: '50' } }, response);
  } finally {
    Article.find = originalFind;
    Article.countDocuments = originalCountDocuments;
  }

  assert.equal(filters[0].isPublished, true);
  assert.equal(filters[2].isPublished, true);
  assert.equal(filters[2].$and[0].$or.some((condition) => condition.title instanceof RegExp), true);
  assert.equal(response.payload.matchMode, 'content');
  assert.equal(response.payload.articles[0].slug, 'startup-india-seed-fund-scheme');
});

test('popular articles follow the reference order and fill from recent published articles', async () => {
  const originalFind = Article.find;
  const filters = [];
  Article.find = (filter) => {
    filters.push(filter);
    return query(filters.length === 1
      ? [
          { slug: 'aloe-vera-farming-details' },
          { slug: '101-low-budget-business-ideas-by-marathi-udyojak' }
        ]
      : [{ slug: 'recent-one' }, { slug: 'recent-two' }, { slug: 'recent-three' }]);
  };

  const response = {
    json(payload) { this.payload = payload; }
  };

  try {
    await getPopularArticles({ query: { limit: '5' } }, response);
  } finally {
    Article.find = originalFind;
  }

  assert.deepEqual(response.payload.articles.map((article) => article.slug), [
    '101-low-budget-business-ideas-by-marathi-udyojak',
    'aloe-vera-farming-details',
    'recent-one',
    'recent-two',
    'recent-three'
  ]);
  assert.deepEqual(filters[0].slug.$in, [
    '101-low-budget-business-ideas-by-marathi-udyojak',
    'agarbatti-manufacturing-business-by-marathi-udyojak',
    'aloe-vera-farming-details',
    'how-to-start-t-shirt-printing-business',
    'the-story-of-ikea-by-marathi-udyojak'
  ]);
  assert.deepEqual(filters[1].slug.$nin, filters[0].slug.$in);
});

test('article views count page loads while keeping unique visitors distinct across refreshes', async () => {
  const originalArticleFindOne = Article.findOne;
  const originalVisitorUpdate = ArticleVisitor.updateOne;
  const originalVisitorCount = ArticleVisitor.countDocuments;
  const originalAnalyticsUpdate = ArticleAnalytics.findOneAndUpdate;
  const originalSecret = process.env.JWT_SECRET;
  const visitorHashes = new Set();
  const visitorId = 'c3ad72f8-0e61-4dca-87f2-4c43465d4127';
  let totalViews = 0;
  const visitorFilters = [];

  Article.findOne = () => ({ select: async () => ({ _id: 'article-id' }) });
  ArticleVisitor.updateOne = async (filter) => {
    visitorFilters.push(filter);
    const isNewVisitor = !visitorHashes.has(filter.visitorHash);
    visitorHashes.add(filter.visitorHash);
    return { upsertedCount: isNewVisitor ? 1 : 0 };
  };
  ArticleVisitor.countDocuments = async () => visitorHashes.size;
  ArticleAnalytics.findOneAndUpdate = async () => ({ totalViews: ++totalViews });
  process.env.JWT_SECRET = 'test-secret';

  const createRequest = () => ({
    params: { slug: 'published-article' },
    body: { visitorId },
    user: undefined,
    get: () => 'Mozilla/5.0'
  });
  const createResponse = () => ({ json(payload) { this.payload = payload; } });

  try {
    const firstResponse = createResponse();
    await trackArticleView(createRequest(), firstResponse);
    const refreshResponse = createResponse();
    await trackArticleView(createRequest(), refreshResponse);

    assert.deepEqual(firstResponse.payload, { tracked: true, totalViews: 1, uniqueVisitors: 1 });
    assert.deepEqual(refreshResponse.payload, { tracked: true, totalViews: 2, uniqueVisitors: 1 });
    assert.notEqual(visitorFilters[0].visitorHash, visitorId);
  } finally {
    Article.findOne = originalArticleFindOne;
    ArticleVisitor.updateOne = originalVisitorUpdate;
    ArticleVisitor.countDocuments = originalVisitorCount;
    ArticleAnalytics.findOneAndUpdate = originalAnalyticsUpdate;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('article view tracking skips administrative users and detected bots', async () => {
  const originalArticleFindOne = Article.findOne;
  Article.findOne = () => { throw new Error('Ignored traffic must not query articles'); };
  const createResponse = () => ({ json(payload) { this.payload = payload; } });

  try {
    const adminResponse = createResponse();
    await trackArticleView({
      params: { slug: 'published-article' },
      body: { visitorId: 'c3ad72f8-0e61-4dca-87f2-4c43465d4127' },
      user: { role: 'admin' },
      get: () => 'Mozilla/5.0'
    }, adminResponse);
    assert.deepEqual(adminResponse.payload, { tracked: false });

    const botResponse = createResponse();
    await trackArticleView({
      params: { slug: 'published-article' },
      body: { visitorId: 'c3ad72f8-0e61-4dca-87f2-4c43465d4127' },
      get: () => 'Googlebot/2.1'
    }, botResponse);
    assert.deepEqual(botResponse.payload, { tracked: false });
  } finally {
    Article.findOne = originalArticleFindOne;
  }
});
