const Article = require('../models/Article');
const ArticleAnalytics = require('../models/ArticleAnalytics');
const ArticleVisitor = require('../models/ArticleVisitor');
const mongoose = require('mongoose');
const crypto = require('crypto');
const slugify = require('../utils/slugify');
const escapeRegex = require('../utils/escapeRegex');
const { withArticleAnalytics } = require('../utils/articleAnalytics');
const writeAuditLog = require('../utils/writeAuditLog');
const { hasPermission } = require('../middleware/permissionMiddleware');
const referencePopularSlugs = [
  '101-low-budget-business-ideas-by-marathi-udyojak',
  'agarbatti-manufacturing-business-by-marathi-udyojak',
  'aloe-vera-farming-details',
  'how-to-start-t-shirt-printing-business',
  'the-story-of-ikea-by-marathi-udyojak'
];

const editableArticleFields = [
  'title', 'slug', 'subtitle', 'content', 'excerpt', 'category', 'additionalCategories', 'authorName', 'sourceUrl', 'image',
  'featuredImage', 'images', 'seoTitle', 'seoDescription', 'sourceUrl', 'canonicalUrl',
  'ogImage', 'tags', 'keywords', 'publicationDate', 'isPublished', 'scheduledAt'
];

const articleInput = (body) => {
  const input = {};
  editableArticleFields.forEach((field) => {
    if (body[field] !== undefined) input[field] = body[field];
  });
  if (typeof input.isPublished === 'string') input.isPublished = input.isPublished === 'true';
  for (const field of ['scheduledAt', 'publicationDate']) {
    if (input[field] === '') input[field] = null;
  }
  for (const field of ['tags', 'keywords', 'images', 'additionalCategories']) {
    if (typeof input[field] === 'string') input[field] = input[field].split(',').map((item) => item.trim()).filter(Boolean);
  }
  input.authorName = 'मराठी उद्योजक';
  return input;
};

const parseArticleBody = (body) => {
  if (typeof body.article !== 'string') return body;
  try {
    return JSON.parse(body.article);
  } catch {
    throw Object.assign(new Error('Article details must be valid JSON'), { statusCode: 400 });
  }
};

const applyPublishSchedule = (input, now = new Date()) => {
  const requestedDate = input.scheduledAt || input.publicationDate;
  const scheduledAt = requestedDate ? new Date(requestedDate) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    throw Object.assign(new Error('Publication date is invalid'), { statusCode: 400 });
  }
  if (scheduledAt && scheduledAt > now) {
    input.isPublished = false;
    input.scheduledAt = scheduledAt;
    input.publicationDate = scheduledAt;
  } else if (input.isPublished === true) {
    input.isPublished = true;
    input.scheduledAt = null;
    input.publicationDate = scheduledAt || now;
  } else if (input.isPublished === false) {
    input.scheduledAt = null;
  }
};

exports.createArticle = async (req, res) => {
  const input = articleInput(parseArticleBody(req.body));
  if (!hasPermission(req.user.role, 'articles:publish')) {
    if (input.isPublished === true || input.scheduledAt || (input.publicationDate && new Date(input.publicationDate) > new Date())) {
      throw Object.assign(new Error('You do not have permission to publish or schedule articles'), { statusCode: 403 });
    }
    input.isPublished = false;
    input.scheduledAt = null;
    input.publicationDate = null;
  }
  const image = req.file ? `/uploads/${req.file.filename}` : input.image;
  input.slug = slugify(input.slug || input.title) || `article-${new mongoose.Types.ObjectId()}`;
  if (image) {
    input.image = image;
    input.featuredImage = input.featuredImage || image;
    input.ogImage = input.ogImage || image;
  }
  applyPublishSchedule(input);
  const article = await Article.create({ ...input, author: req.user._id });
  const Revision = require('../models/Revision');
  await Revision.create({ entityType: 'article', entityId: article._id, action: 'create', summary: `Article "${article.title}" created`, newValue: article.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'article.create', 'article', article._id, `Article "${article.title}" created`);
  res.status(201).json({ article: (await withArticleAnalytics([article]))[0] });
};

exports.updateArticle = async (req, res) => {
  const oldArticle = await Article.findById(req.params.id).lean();
  if (!oldArticle) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  const input = articleInput(parseArticleBody(req.body));
  if (input.slug !== undefined) input.slug = slugify(input.slug);
  if (!hasPermission(req.user.role, 'articles:publish')) {
    const requestedScheduledAt = input.scheduledAt ? new Date(input.scheduledAt).getTime() : null;
    const currentScheduledAt = oldArticle.scheduledAt ? new Date(oldArticle.scheduledAt).getTime() : null;
    const requestedPublicationDate = input.publicationDate ? new Date(input.publicationDate).getTime() : null;
    const currentPublicationDate = oldArticle.publicationDate ? new Date(oldArticle.publicationDate).getTime() : null;
    if (
      (input.isPublished !== undefined && Boolean(input.isPublished) !== Boolean(oldArticle.isPublished))
      || (input.scheduledAt !== undefined && requestedScheduledAt !== currentScheduledAt)
      || (input.publicationDate !== undefined && requestedPublicationDate !== currentPublicationDate)
    ) {
      throw Object.assign(new Error('You do not have permission to publish or schedule articles'), { statusCode: 403 });
    }
  }
  if (req.file) {
    input.image = `/uploads/${req.file.filename}`;
    input.featuredImage = input.image;
    input.ogImage = input.ogImage || input.image;
  }
  if (oldArticle.isPublished && input.slug && input.slug !== oldArticle.slug) {
    throw Object.assign(new Error('Published article slugs cannot be changed until redirect support is configured'), { statusCode: 409 });
  }
  applyPublishSchedule(input);
  const article = await Article.findByIdAndUpdate(req.params.id, { $set: input }, { new: true, runValidators: true });
  const Revision = require('../models/Revision');
  await Revision.create({ entityType: 'article', entityId: article._id, action: 'update', summary: `Article "${article.title}" updated`, oldValue: oldArticle, newValue: article.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'article.update', 'article', article._id, `Article "${article.title}" updated`);
  res.json({ article: (await withArticleAnalytics([article]))[0] });
};

exports.deleteArticle = async (req, res) => {
  const article = await Article.findById(req.params.id);
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  const before = article.toObject();
  article.isPublished = false;
  article.scheduledAt = null;
  article.archivedAt = new Date();
  await article.save();
  const Revision = require('../models/Revision');
  await Revision.create({ entityType: 'article', entityId: article._id, action: 'archive', summary: `Article "${article.title}" archived`, oldValue: before, newValue: article.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'article.archive', 'article', article._id, `Article "${article.title}" archived`);
  res.json({ message: 'Article archived', article: (await withArticleAnalytics([article]))[0] });
};

exports.publishArticle = async (req, res) => {
  const before = await Article.findById(req.params.id);
  if (!before) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  const article = await Article.findByIdAndUpdate(req.params.id, { $set: { isPublished: true, publicationDate: new Date(), scheduledAt: null, archivedAt: null } }, { new: true, runValidators: true });
  await require('../models/Revision').create({
    entityType: 'article',
    entityId: article._id,
    action: 'publish',
    summary: `Article "${article.title}" published`,
    oldValue: before.toObject(),
    newValue: article.toObject(),
    editor: req.user._id
  });
  await writeAuditLog(req, 'article.publish', 'article', article._id, `Article "${article.title}" published`);
  res.json({ article: (await withArticleAnalytics([article]))[0] });
};

exports.restoreArticle = async (req, res) => {
  const article = await Article.findByIdAndUpdate(req.params.id, { $set: { isPublished: false, scheduledAt: null, archivedAt: null } }, { new: true, runValidators: true });
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  const Revision = require('../models/Revision');
  await Revision.create({ entityType: 'article', entityId: article._id, action: 'restore', summary: `Article "${article.title}" restored as a draft`, newValue: article.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'article.restore', 'article', article._id, `Article "${article.title}" restored as a draft`);
  res.json({ article: (await withArticleAnalytics([article]))[0] });
};
exports.getArticles = async (req, res) => {
  const filter = req.query.all === 'true' && req.user?.role === 'admin' ? {} : { isPublished: true };
  let categoryName = req.query.category || '';
  if (req.query.category) {
    const Category = require('../models/Category');
    const category = await Category.findOne({ $or: [{ slug: req.query.category }, { name: req.query.category }] });
    categoryName = category?.name || req.query.category;
    filter.$or = [
      { category: categoryName },
      { additionalCategories: categoryName }
    ];
  }
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const terms = search.split(/\s+/).filter(Boolean).slice(0, 8);
    const fields = ['title', 'content', 'excerpt', 'subtitle', 'seoDescription', 'category', 'tags', 'keywords'];
    filter.$and = terms.map((term) => ({
      $or: fields.map((field) => ({ [field]: new RegExp(escapeRegex(term), 'i') }))
    }));
  }
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 12, 50);
  const [articles, total] = await Promise.all([Article.find(filter).populate('author', 'name').sort({ publicationDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit), Article.countDocuments(filter)]);
  res.json({ articles: await withArticleAnalytics(articles), categoryName, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};
exports.getArticleSuggestions = async (req, res) => {
  const prefix = String(req.query.prefix || '').trim().slice(0, 100);
  if (!prefix) {
    res.json({ articles: [], matchMode: 'title-prefix', pagination: { page: 1, limit: 50, total: 0, pages: 0 } });
    return;
  }
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 50, 50);
  const loadPage = async (filter) => Promise.all([
    Article.find(filter)
      .select('slug title category featuredImage ogImage image publicationDate excerpt subtitle')
      .sort({ publicationDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Article.countDocuments(filter)
  ]);
  let matchMode = 'title-prefix';
  let filter = { isPublished: true, title: new RegExp(`^${escapeRegex(prefix)}`, 'i') };
  let [articles, total] = await loadPage(filter);
  if (!total) {
    const fields = ['title', 'content', 'excerpt', 'subtitle', 'seoDescription', 'category', 'tags', 'keywords'];
    const terms = prefix.split(/\s+/).filter(Boolean).slice(0, 8);
    filter = {
      isPublished: true,
      $and: terms.map((term) => ({
        $or: fields.map((field) => ({ [field]: new RegExp(escapeRegex(term), 'i') }))
      }))
    };
    [articles, total] = await loadPage(filter);
    matchMode = 'content';
  }
  res.json({ articles, matchMode, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};
exports.getArticleBySlug = async (req, res) => {
  const filter = mongoose.isValidObjectId(req.params.slug)
    ? { $or: [{ slug: req.params.slug }, { _id: req.params.slug }], isPublished: true }
    : { slug: req.params.slug, isPublished: true };
  const article = await Article.findOne(filter).populate('author', 'name');
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  res.json({ article: (await withArticleAnalytics([article]))[0] });
};

exports.trackArticleView = async (req, res) => {
  const privilegedRoles = ['admin', 'super_admin', 'content_editor', 'design_manager', 'viewer', 'analyst', 'store_manager'];
  const userAgent = req.get('user-agent') || '';
  if (privilegedRoles.includes(req.user?.role) || !userAgent || /bot|crawler|spider|slurp|headless|preview|facebookexternalhit|whatsapp|curl|wget|python-requests|scrapy|phantomjs/i.test(userAgent)) {
    res.json({ tracked: false });
    return;
  }

  const visitorId = String(req.body.visitorId || '').trim();
  if (!/^[a-zA-Z0-9._-]{16,128}$/.test(visitorId)) {
    throw Object.assign(new Error('Valid visitor identifier required'), { statusCode: 400 });
  }

  const article = await Article.findOne({ slug: req.params.slug, isPublished: true }).select('_id');
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });

  const visitorHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(visitorId).digest('hex');
  try {
    await ArticleVisitor.updateOne(
      { article: article._id, visitorHash },
      { $setOnInsert: { article: article._id, visitorHash } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  const analytics = await ArticleAnalytics.findOneAndUpdate(
    { article: article._id },
    { $inc: { totalViews: 1 }, $setOnInsert: { article: article._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const uniqueVisitors = await ArticleVisitor.countDocuments({ article: article._id });
  res.json({ tracked: true, totalViews: analytics.totalViews, uniqueVisitors });
};

exports.addArticleComment = async (req, res) => {
  const article = await Article.findOne({ slug: req.params.slug, isPublished: true });
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  const name = String(req.body.name || '').trim();
  const message = String(req.body.message || '').trim();
  if (name.length < 2 || message.length < 10) {
    throw Object.assign(new Error('Name आणि Comment योग्य भरावे.'), { statusCode: 400 });
  }
  article.comments.push({
    name,
    email: String(req.body.email || '').trim(),
    website: String(req.body.website || '').trim(),
    message
  });
  await article.save();
  res.status(201).json({
    message: 'टिप्पणी सेव झाली.',
    commentCount: article.comments.filter((comment) => comment.isApproved !== false).length
  });
};

exports.getLatestArticles = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 50);
  const articles = await Article.find({ isPublished: true }).populate('author', 'name').sort({ publicationDate: -1, createdAt: -1 }).limit(limit);
  res.json({ articles });
};

exports.getPopularArticles = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 8, 30);
  const pinnedArticles = await Article.find({
    isPublished: true,
    slug: { $in: referencePopularSlugs }
  }).populate('author', 'name').lean();
  const articlesBySlug = new Map(pinnedArticles.map((article) => [article.slug, article]));
  const articles = referencePopularSlugs
    .map((slug) => articlesBySlug.get(slug))
    .filter(Boolean)
    .slice(0, limit);

  if (articles.length < limit) {
    const recentArticles = await Article.find({
      isPublished: true,
      slug: { $nin: referencePopularSlugs }
    }).populate('author', 'name').sort({ publicationDate: -1, createdAt: -1 }).limit(limit - articles.length);
    articles.push(...recentArticles);
  }

  res.json({ articles });
};

exports.getRelatedArticles = async (req, res) => {
  const article = await Article.findOne({ slug: req.params.slug, isPublished: true });
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  const limit = Math.min(Number(req.query.limit) || 6, 20);
  const categories = article.additionalCategories?.length
    ? article.additionalCategories
    : article.category && article.category !== 'General'
      ? [article.category]
      : [];
  const articles = categories.length
    ? await Article.find({
      isPublished: true,
      slug: { $ne: article.slug },
      $or: [
        { category: { $in: categories } },
        { additionalCategories: { $in: categories } }
      ]
    }).sort({ publicationDate: -1, createdAt: -1 }).limit(limit)
    : [];
  res.json({ articles });
};

exports.getHomepage = async (_req, res) => {
  const HomepageSection = require('../models/HomepageSection');
  const sections = await HomepageSection.find({ isActive: true }).sort({ order: 1 });
  const result = [];
  for (const section of sections) {
    let articles;
    if (section.articleIds?.length) {
      articles = await Article.find({ _id: { $in: section.articleIds }, isPublished: true });
      const order = new Map(section.articleIds.map((id, index) => [String(id), index]));
      articles.sort((a, b) => (order.get(String(a._id)) ?? 999) - (order.get(String(b._id)) ?? 999));
      articles = articles.slice(0, section.limit);
    } else {
    const filter = { isPublished: true };
    if (section.categorySlug) {
      const Category = require('../models/Category');
      const category = await Category.findOne({ slug: section.categorySlug });
      if (category) filter.category = category.name;
    }
      articles = await Article.find(filter).sort({ publicationDate: -1, createdAt: -1 }).limit(section.limit);
    }
    result.push({ key: section.key, title: section.title, subtitle: section.subtitle, categorySlug: section.categorySlug, limit: section.limit, articles });
  }
  res.json({ sections: result });
};
