const Article = require('../models/Article');
const ArticleAnalytics = require('../models/ArticleAnalytics');
const ArticleVisitor = require('../models/ArticleVisitor');
const Enquiry = require('../models/Enquiry');
const Payment = require('../models/Payment');
const BookOrder = require('../models/BookOrder');
const escapeRegex = require('../utils/escapeRegex');

const getDateRange = (query) => {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw Object.assign(new Error('Analytics date range is invalid'), { statusCode: 400 });
  }
  if (to.getTime() - from.getTime() > 90 * 24 * 60 * 60 * 1000) {
    throw Object.assign(new Error('Analytics date range cannot exceed 90 days'), { statusCode: 400 });
  }
  return { from, to };
};

exports.overview = async (req, res) => {
  const { from, to } = getDateRange(req.query);
  const [
    publishedArticles,
    draftArticles,
    totalViews,
    uniqueVisitors,
    dailyVisitors,
    topArticles,
    viewsByCategory,
    bookSalesTrend,
    newEnquiries,
    paidPaymentSummary,
    paidBookSummary
  ] = await Promise.all([
    Article.countDocuments({ isPublished: true }),
    Article.countDocuments({ isPublished: false, archivedAt: null }),
    ArticleAnalytics.aggregate([{ $group: { _id: null, value: { $sum: '$totalViews' } } }]),
    ArticleVisitor.aggregate([{ $group: { _id: '$visitorHash' } }, { $count: 'value' }]),
    ArticleVisitor.aggregate([
      { $match: { firstSeenAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$firstSeenAt', timezone: 'Asia/Kolkata' } }, visitors: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    ArticleAnalytics.aggregate([
      { $sort: { totalViews: -1 } },
      { $limit: 10 },
      { $lookup: { from: Article.collection.name, localField: 'article', foreignField: '_id', as: 'article' } },
      { $unwind: '$article' },
      { $project: { _id: 0, articleId: '$article._id', title: '$article.title', slug: '$article.slug', category: '$article.category', totalViews: 1 } }
    ]),
    ArticleAnalytics.aggregate([
      { $lookup: { from: Article.collection.name, localField: 'article', foreignField: '_id', as: 'article' } },
      { $unwind: '$article' },
      { $group: { _id: '$article.category', views: { $sum: '$totalViews' } } },
      { $sort: { views: -1 } },
      { $limit: 10 }
    ]),
    BookOrder.aggregate([
      { $match: { paymentStatus: 'paid', verifiedAt: { $gte: from, $lte: to } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$verifiedAt', timezone: 'Asia/Kolkata' } },
        orders: { $sum: 1 },
        revenuePaise: { $sum: '$amountPaise' }
      } },
      { $sort: { _id: 1 } }
    ]),
    Enquiry.countDocuments({ status: 'new' }),
    Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, count: { $sum: 1 }, amountPaise: { $sum: '$amountPaise' } } }
    ]),
    BookOrder.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, count: { $sum: 1 }, amountPaise: { $sum: '$amountPaise' } } }
    ])
  ]);
  const views = totalViews[0]?.value || 0;
  const visitorCount = uniqueVisitors[0]?.value || 0;
  const hasArticleAnalytics = views > 0 || visitorCount > 0;
  const paymentSummary = paidPaymentSummary[0] || { count: 0, amountPaise: 0 };
  const bookSummary = paidBookSummary[0] || { count: 0, amountPaise: 0 };
  res.json({
    range: { from, to },
    hasArticleAnalytics,
    metrics: {
      articleViews: hasArticleAnalytics ? views : null,
      uniqueArticleVisitors: hasArticleAnalytics ? visitorCount : null,
      publishedArticles,
      draftArticles,
      newEnquiries,
      verifiedPaidPayments: paymentSummary.count,
      verifiedRevenuePaise: paymentSummary.amountPaise,
      verifiedBookOrders: bookSummary.count,
      verifiedBookRevenuePaise: bookSummary.amountPaise
    },
    charts: {
      firstSeenUniqueVisitors: dailyVisitors,
      topArticles,
      viewsByCategory,
      bookSalesTrend
    },
    unavailableMetrics: ['All-page sessions', 'Bounce rate', 'Engagement time', 'Traffic source', 'Device breakdown'],
    trackingNote: hasArticleAnalytics
      ? 'Article views are lifetime counters. Unique visitors are distinct first-party visitor IDs across articles; the selected date range applies only to first-seen visitor trend.'
      : 'No article analytics data yet. Public article-view tracking is available; page-wide sessions and engagement are not collected.'
  });
};

exports.articles = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const search = String(req.query.search || '').trim().slice(0, 100);
  const filter = {};
  if (search) filter.$or = [
    { title: new RegExp(escapeRegex(search), 'i') },
    { slug: new RegExp(escapeRegex(search), 'i') }
  ];
  const [articles, total] = await Promise.all([
    Article.find(filter).select('title slug category isPublished publicationDate').sort({ publicationDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Article.countDocuments(filter)
  ]);
  const ids = articles.map((article) => article._id);
  const [viewRecords, visitorRecords] = await Promise.all([
    ArticleAnalytics.find({ article: { $in: ids } }).select('article totalViews').lean(),
    ArticleVisitor.aggregate([{ $match: { article: { $in: ids } } }, { $group: { _id: '$article', uniqueVisitors: { $sum: 1 }, lastViewedAt: { $max: '$firstSeenAt' } } }])
  ]);
  const viewsById = new Map(viewRecords.map((record) => [String(record.article), record.totalViews]));
  const visitorsById = new Map(visitorRecords.map((record) => [String(record._id), record]));
  res.json({
    articles: articles.map((article) => ({
      ...article,
      totalViews: viewsById.get(String(article._id)) ?? null,
      uniqueVisitors: visitorsById.get(String(article._id))?.uniqueVisitors ?? null,
      lastViewedAt: visitorsById.get(String(article._id))?.lastViewedAt || null
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    measurement: 'Views are lifetime counters; unique visitors are per-article first-party IDs.'
  });
};
