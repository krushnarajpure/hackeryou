const Article = require('../models/Article');
const ArticleAnalytics = require('../models/ArticleAnalytics');
const ArticleVisitor = require('../models/ArticleVisitor');
const WebsiteVisitor = require('../models/WebsiteVisitor');
const WebsiteVisitorDay = require('../models/WebsiteVisitorDay');
const WebsitePageView = require('../models/WebsitePageView');
const Enquiry = require('../models/Enquiry');
const Payment = require('../models/Payment');
const BookOrder = require('../models/BookOrder');
const escapeRegex = require('../utils/escapeRegex');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

const getIndiaDayKey = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(date);

const getRecentDayKeys = (today, count) => Array.from({ length: count }, (_, index) => {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (count - index - 1));
  return date.toISOString().slice(0, 10);
});

const isPrivilegedRole = (role) => ['admin', 'super_admin', 'content_editor', 'design_manager', 'viewer', 'analyst', 'store_manager'].includes(role);

exports.trackPageView = async (req, res) => {
  const userAgent = req.get('user-agent') || '';
  if (isPrivilegedRole(req.user?.role) || !userAgent || /bot|crawler|spider|slurp|headless|preview|facebookexternalhit|whatsapp|curl|wget|python-requests|scrapy|phantomjs/i.test(userAgent)) {
    res.json({ tracked: false });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) throw Object.assign(new Error(errors.array()[0].msg), { statusCode: 400 });
  const { visitorId, path: pagePath, title = '' } = req.body || {};
  if (pagePath.toLowerCase() === '/admin' || pagePath.toLowerCase().startsWith('/admin/')) {
    res.json({ tracked: false });
    return;
  }
  if (!process.env.JWT_SECRET) throw Object.assign(new Error('Analytics tracking is unavailable'), { statusCode: 503 });

  const now = new Date();
  const day = getIndiaDayKey(now);
  const visitorHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(visitorId).digest('hex');
  const ignoreDuplicateUpsert = (update) => update.catch((error) => {
    if (error.code !== 11000) throw error;
  });
  const pageViewUpdate = async () => {
    const filter = { day, path: pagePath };
    const update = {
      $inc: { pageViews: 1 },
      $set: { title: String(title).trim().slice(0, 200) },
      $setOnInsert: filter
    };
    try {
      await WebsitePageView.updateOne(filter, update, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      await WebsitePageView.updateOne(filter, {
        $inc: { pageViews: 1 },
        $set: { title: String(title).trim().slice(0, 200) }
      });
    }
  };
  await Promise.all([
    ignoreDuplicateUpsert(WebsiteVisitor.updateOne(
      { visitorHash },
      { $setOnInsert: { visitorHash, firstSeenAt: now } },
      { upsert: true }
    )),
    ignoreDuplicateUpsert(WebsiteVisitorDay.updateOne(
      { visitorHash, day },
      { $setOnInsert: { visitorHash, day, firstSeenAt: now } },
      { upsert: true }
    )),
    pageViewUpdate()
  ]);
  res.json({ tracked: true });
};

const getWebsiteMetrics = async () => {
  const today = getIndiaDayKey(new Date());
  const days = getRecentDayKeys(today, 30);
  const firstDay = days[0];
  const sevenDayStart = days[23];
  const [totalVisitors, visitorDays, pageViewMetrics, totalComments] = await Promise.all([
    WebsiteVisitor.countDocuments(),
    WebsiteVisitorDay.aggregate([
      { $match: { day: { $gte: firstDay, $lte: today } } },
      { $group: { _id: '$day', visitors: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    WebsitePageView.aggregate([
      {
        $facet: {
          totals: [{ $group: { _id: null, total: { $sum: '$pageViews' } } }],
          daily: [
            { $match: { day: { $gte: firstDay, $lte: today } } },
            { $group: { _id: '$day', pageViews: { $sum: '$pageViews' } } },
            { $sort: { _id: 1 } }
          ],
          topPages: [
            { $group: { _id: '$path', title: { $last: '$title' }, pageViews: { $sum: '$pageViews' } } },
            { $sort: { pageViews: -1, _id: 1 } },
            { $limit: 10 }
          ]
        }
      }
    ]),
    Article.aggregate([{ $unwind: '$comments' }, { $count: 'total' }])
  ]);
  const visitorByDay = new Map(visitorDays.map((point) => [point._id, point.visitors]));
  const pageViewReport = pageViewMetrics[0] || { totals: [], daily: [], topPages: [] };
  const pageViewsByDay = new Map(pageViewReport.daily.map((point) => [point._id, point.pageViews]));
  const sumBetween = (counts, start, end) => days
    .filter((day) => day >= start && day <= end)
    .reduce((sum, day) => sum + (counts.get(day) || 0), 0);

  return {
    totalVisitors,
    totalPageViews: pageViewReport.totals[0]?.total || 0,
    todayVisitors: visitorByDay.get(today) || 0,
    todayPageViews: pageViewsByDay.get(today) || 0,
    last7DaysVisitors: sumBetween(visitorByDay, sevenDayStart, today),
    last30DaysVisitors: sumBetween(visitorByDay, firstDay, today),
    totalComments: totalComments[0]?.total || 0,
    dailyVisitors: days.map((day) => ({ day, visitors: visitorByDay.get(day) || 0 })),
    topPages: pageViewReport.topPages.map((page) => ({ path: page._id, title: page.title, pageViews: page.pageViews }))
  };
};

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
  const website = await getWebsiteMetrics();
  const { dailyVisitors: websiteDailyVisitors, topPages: websiteTopPages, ...websiteMetrics } = website;
  const paymentSummary = paidPaymentSummary[0] || { count: 0, amountPaise: 0 };
  const bookSummary = paidBookSummary[0] || { count: 0, amountPaise: 0 };
  res.json({
    range: { from, to },
    hasArticleAnalytics,
    metrics: {
      ...websiteMetrics,
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
      dailyVisitors: websiteDailyVisitors,
      topPages: websiteTopPages,
      firstSeenUniqueVisitors: dailyVisitors,
      topArticles,
      viewsByCategory,
      bookSalesTrend
    },
    unavailableMetrics: ['Sessions', 'Bounce rate', 'Engagement time', 'Traffic source', 'Device breakdown'],
    trackingNote: hasArticleAnalytics
      ? 'Website visitors are counted using anonymous first-party browser IDs; page views count route loads. Article view counters are separate lifetime totals. No IP addresses or page query strings are stored.'
      : 'Website visitor/page-view tracking starts from deployment. Article view counters are separate. No IP addresses or page query strings are stored.'
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
