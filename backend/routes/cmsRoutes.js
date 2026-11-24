const express = require('express');
const fs = require('fs');
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const upload = require('../middleware/uploadMiddleware');
const WebsiteSettings = require('../models/WebsiteSettings');
const GlobalContent = require('../models/GlobalContent');
const Revision = require('../models/Revision');
const Media = require('../models/Media');
const Page = require('../models/Page');
const Article = require('../models/Article');
const { withArticleAnalytics } = require('../utils/articleAnalytics');
const HomepageSection = require('../models/HomepageSection');
const NavigationMenu = require('../models/NavigationMenu');
const Category = require('../models/Category');
const escapeRegex = require('../utils/escapeRegex');
const writeAuditLog = require('../utils/writeAuditLog');
const { storeMediaFile, deleteMediaFile } = require('../utils/mediaStorage');
const normalizeFeatureCards = require('../utils/normalizeBusinessFeatureCards');
const { isValidIndianMobile, normalizeSettings, prepareSettingsUpdate } = require('../utils/websiteSettings');

const router = express.Router();
const protect = (permission) => [auth, requirePermission(permission)];
const pickFields = (source, fields) => Object.fromEntries(fields
  .filter((field) => source[field] !== undefined)
  .map((field) => [field, source[field]]));

router.get('/public/settings', async (_req, res) => {
  const settings = await WebsiteSettings.findOne({ key: 'main' }).lean();
  res.json({ settings: normalizeSettings(settings || {}) });
});

router.get('/public/content', async (req, res) => {
  const filter = { status: 'published' };
  if (req.query.page) filter.page = { $in: ['global', req.query.page] };
  const items = await GlobalContent.find(filter).sort({ key: 1 }).lean();
  res.json({ content: items });
});

router.get('/public/homepage-business-essentials', async (_req, res) => {
  const section = await HomepageSection.findOne({ key: 'business-essentials' })
    .select('title subtitle isActive featureCards')
    .lean();
  res.json({
    section: section ? {
      title: section.title,
      subtitle: section.subtitle,
      isActive: section.isActive,
      featureCards: section.featureCards || []
    } : null
  });
});

router.get('/articles', ...protect('articles:read'), async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const filter = {};
  if (req.query.status === 'published') filter.isPublished = true;
  if (req.query.status === 'draft') filter.isPublished = false;
  if (req.query.category) filter.category = String(req.query.category).slice(0, 100);
  if (req.query.search) {
    const search = String(req.query.search).trim().slice(0, 100);
    if (search) filter.$or = [
      { title: new RegExp(escapeRegex(search), 'i') },
      { slug: new RegExp(escapeRegex(search), 'i') }
    ];
  }
  const [articles, total] = await Promise.all([
    Article.find(filter).populate('author', 'name').sort({ publicationDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Article.countDocuments(filter)
  ]);
  const hydrated = await withArticleAnalytics(articles);
  res.json({ articles: hydrated, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/settings', ...protect('settings:read'), async (_req, res) => {
  const settings = await WebsiteSettings.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ settings: normalizeSettings(settings.toObject()) });
});
router.put('/settings', ...protect('settings:write'), async (req, res) => {
  if (req.body.defaultPhone !== undefined && !isValidIndianMobile(req.body.defaultPhone)) {
    return res.status(400).json({ message: 'Enter a valid 10-digit contact mobile number.' });
  }
  if (req.body.contacts?.whatsappNumber !== undefined && !isValidIndianMobile(req.body.contacts.whatsappNumber)) {
    return res.status(400).json({ message: 'Enter a valid 10-digit WhatsApp number.' });
  }
  const before = await WebsiteSettings.findOne({ key: 'main' }).lean();
  const submitted = pickFields(req.body, [
    'websiteName', 'websiteUrl', 'logo', 'favicon', 'tagline', 'language', 'timezone',
    'defaultEmail', 'defaultPhone', 'address', 'maintenanceMode', 'contacts', 'social',
    'seo', 'design', 'store', 'headers', 'footers', 'defaultHeader', 'defaultFooter'
  ]);
  const input = prepareSettingsUpdate(submitted, before || {});
  const settings = await WebsiteSettings.findOneAndUpdate({ key: 'main' }, { $set: input }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  await Revision.create({ entityType: 'settings', entityId: settings._id, action: 'update', summary: 'Website settings updated', oldValue: before, newValue: settings.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'settings.update', 'settings', settings._id, 'Website settings updated');
  res.json({ settings });
});

router.get('/content', ...protect('global:read'), async (req, res) => {
  const search = String(req.query.search || '').trim();
  const filter = {};
  if (search) {
    const safeSearch = escapeRegex(search.slice(0, 100));
    filter.$or = [{ key: new RegExp(safeSearch, 'i') }, { label: new RegExp(safeSearch, 'i') }, { value: new RegExp(safeSearch, 'i') }];
  }
  if (req.query.page) filter.page = req.query.page;
  res.json({ content: await GlobalContent.find(filter).sort({ key: 1 }) });
});
router.post('/content', ...protect('global:write'), async (req, res) => {
  const before = req.body.key ? await GlobalContent.findOne({ key: req.body.key }).lean() : null;
  const input = pickFields(req.body, ['key', 'label', 'value', 'type', 'page', 'component', 'status']);
  if (!input.key) return res.status(400).json({ message: 'A content key is required' });
  const content = await GlobalContent.findOneAndUpdate({ key: input.key }, { $set: input }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  await Revision.create({ entityType: 'global-content', entityId: content._id, action: 'update', summary: `Content "${content.key}" updated`, oldValue: before, newValue: content.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'content.update', 'global-content', content._id, `Content "${content.key}" updated`);
  res.status(before ? 200 : 201).json({ content });
});

router.get('/pages', ...protect('pages:read'), async (_req, res) => {
  const pages = await Page.find().sort({ title: 1 });
  res.json({
    pages: pages.map((page) => ({
      ...page.toObject(),
      pageType: page.pageType || 'page',
      status: page.status || (page.isPublished ? 'published' : 'draft')
    }))
  });
});
const pageFields = ['title', 'slug', 'subtitle', 'content', 'sections', 'pageType', 'status', 'headerTemplate', 'footerTemplate', 'sidebarTemplate', 'excerpt', 'featuredImage', 'sourceUrl', 'seoTitle', 'seoDescription', 'canonicalUrl', 'isPublished'];
const preparePage = (data) => {
  const page = pickFields(data, pageFields);
  if (page.status) page.isPublished = page.status === 'published';
  else if (typeof page.isPublished === 'boolean') page.status = page.isPublished ? 'published' : 'draft';
  return page;
};
router.post('/pages', ...protect('pages:write'), async (req, res) => {
  const page = await Page.create(preparePage(req.body));
  await Revision.create({ entityType: 'page', entityId: page._id, action: 'create', summary: `Page "${page.title}" created`, newValue: page.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'page.create', 'page', page._id, `Page "${page.title}" created`);
  res.status(201).json({ page });
});
router.put('/pages/:id', ...protect('pages:write'), async (req, res) => {
  const before = await Page.findById(req.params.id).lean();
  if (!before) return res.status(404).json({ message: 'Page not found' });
  const page = await Page.findByIdAndUpdate(req.params.id, preparePage(req.body), { new: true, runValidators: true });
  await Revision.create({ entityType: 'page', entityId: page._id, action: 'update', summary: `Page "${page.title}" updated`, oldValue: before, newValue: page.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'page.update', 'page', page._id, `Page "${page.title}" updated`);
  res.json({ page });
});
router.delete('/pages/:id', ...protect('pages:write'), async (req, res) => {
  const page = await Page.findById(req.params.id);
  if (!page) return res.status(404).json({ message: 'Page not found' });
  const before = page.toObject();
  page.status = 'archived';
  page.isPublished = false;
  await page.save();
  await Revision.create({ entityType: 'page', entityId: page._id, action: 'archive', summary: `Page "${page.title}" archived`, oldValue: before, newValue: page.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'page.archive', 'page', page._id, `Page "${page.title}" archived`);
  res.json({ message: 'Page archived', page });
});

router.get('/homepage', ...protect('homepage:read'), async (_req, res) => res.json({ sections: await HomepageSection.find().populate('articleIds', 'title slug featuredImage image').sort({ order: 1 }) }));
router.post('/homepage', ...protect('homepage:write'), async (req, res) => {
  const input = pickFields(req.body, ['key', 'title', 'subtitle', 'categorySlug', 'limit', 'order', 'isActive', 'articleIds', 'featureCards', 'desktopLayout', 'mobileLayout', 'viewAllLink', 'background', 'spacing']);
  if (!input.key) return res.status(400).json({ message: 'A homepage section key is required' });
  if (input.featureCards !== undefined) input.featureCards = normalizeFeatureCards(input.featureCards);
  const section = await HomepageSection.findOneAndUpdate({ key: input.key }, { $set: input }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  await Revision.create({ entityType: 'homepage-section', entityId: section._id, action: 'update', summary: `Homepage section "${section.title}" updated`, newValue: section.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'homepage-section.update', 'homepage-section', section._id, `Homepage section "${section.title}" updated`);
  res.status(200).json({ section });
});
router.delete('/homepage/:id', ...protect('homepage:write'), async (req, res) => {
  const before = await HomepageSection.findById(req.params.id);
  if (!before) return res.status(404).json({ message: 'Homepage section not found' });
  const section = await HomepageSection.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true, runValidators: true });
  await Revision.create({ entityType: 'homepage-section', entityId: section._id, action: 'archive', summary: `Homepage section "${section.title}" disabled`, oldValue: before.toObject(), newValue: section.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'homepage-section.disable', 'homepage-section', section._id, `Homepage section "${section.title}" disabled`);
  res.json({ message: 'Homepage section disabled', section });
});

router.get('/navigation', ...protect('navigation:read'), async (_req, res) => res.json({ menus: await NavigationMenu.find().sort({ location: 1, createdAt: 1 }) }));
router.post('/navigation', ...protect('navigation:write'), async (req, res) => {
  const input = pickFields(req.body, ['key', 'label', 'location', 'items', 'isActive']);
  if (!input.key) return res.status(400).json({ message: 'A navigation menu key is required' });
  const menu = await NavigationMenu.findOneAndUpdate({ key: input.key }, { $set: input }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  await Revision.create({ entityType: 'navigation', entityId: menu._id, action: 'update', summary: `Navigation "${menu.label}" updated`, newValue: menu.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'navigation.update', 'navigation', menu._id, `Navigation "${menu.label}" updated`);
  res.json({ menu });
});

router.get('/media', ...protect('media:read'), async (req, res) => {
  const filter = {};
  if (req.query.search) filter.$text = { $search: req.query.search };
  res.json({ media: await Media.find(filter).sort({ createdAt: -1 }) });
});
router.post('/media', ...protect('media:write'), upload.single('image'), upload.validateImages, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Image file is required' });
  const mediaId = new mongoose.Types.ObjectId();
  let gridFsFileId;
  let media;
  try {
    gridFsFileId = await storeMediaFile(req.file, {
      mimeType: req.file.mimetype,
      uploadedBy: String(req.user._id)
    });
    media = await Media.create({
      _id: mediaId,
      title: req.body.title || req.file.originalname,
      altText: req.body.altText || '',
      caption: req.body.caption || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      gridFsFileId,
      mediaType: 'image',
      uploadedBy: req.user._id,
      url: `/api/media/${mediaId}/content`,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
    await fs.promises.unlink(req.file.path);
    await writeAuditLog(req, 'media.upload', 'media', media._id, `Media "${media.title}" uploaded`);
  } catch (error) {
    const cleanupErrors = [];
    if (media) {
      try {
        await Media.deleteOne({ _id: media._id });
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (gridFsFileId) {
      try {
        await deleteMediaFile(gridFsFileId);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    try {
      await fs.promises.unlink(req.file.path);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') cleanupErrors.push(cleanupError);
    }
    if (cleanupErrors.length) console.error('Media upload cleanup failed:', cleanupErrors.map((item) => item.message).join('; '));
    throw error;
  }
  res.status(201).json({ media });
});
router.put('/media/:id', ...protect('media:write'), async (req, res) => {
  const input = pickFields(req.body, ['title', 'altText', 'caption', 'width', 'height', 'usages']);
  const media = await Media.findByIdAndUpdate(req.params.id, { $set: input }, { new: true, runValidators: true });
  if (!media) return res.status(404).json({ message: 'Media not found' });
  await writeAuditLog(req, 'media.update', 'media', media._id, `Media "${media.title}" updated`);
  res.json({ media });
});
router.delete('/media/:id', ...protect('media:write'), async (req, res) => {
  const media = await Media.findById(req.params.id);
  if (!media) return res.status(404).json({ message: 'Media not found' });
  const isReferenced = await Promise.all([
    Article.exists({ $or: [{ image: media.url }, { featuredImage: media.url }, { ogImage: media.url }, { images: media.url }] }),
    Page.exists({ featuredImage: media.url }),
    Category.exists({ image: media.url })
  ]);
  if (isReferenced.some(Boolean)) return res.status(409).json({ message: 'This image is in use. Remove its references before deleting it.' });
  await media.deleteOne();
  await writeAuditLog(req, 'media.delete', 'media', media._id, `Media "${media.title}" metadata deleted`);
  res.json({ message: 'Media record deleted; uploaded file retained for backup safety' });
});

router.get('/revisions', ...protect('revisions:read'), async (req, res) => {
  const filter = {};
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.entityId) filter.entityId = req.query.entityId;
  res.json({ revisions: await Revision.find(filter).populate('editor', 'name email').sort({ createdAt: -1 }).limit(100) });
});
router.post('/revisions/:id/restore', ...protect('revisions:restore'), async (req, res) => {
  const revision = await Revision.findById(req.params.id);
  if (!revision || !revision.oldValue) return res.status(404).json({ message: 'Restorable revision not found' });
  let restored = null;
  const models = {
    settings: [WebsiteSettings, ['websiteName', 'websiteUrl', 'logo', 'favicon', 'tagline', 'language', 'timezone', 'defaultEmail', 'defaultPhone', 'address', 'maintenanceMode', 'contacts', 'social', 'seo', 'design', 'store', 'headers', 'footers', 'defaultHeader', 'defaultFooter']],
    'global-content': [GlobalContent, ['key', 'label', 'value', 'type', 'page', 'component', 'status']],
    page: [Page, pageFields],
    'homepage-section': [HomepageSection, ['key', 'title', 'subtitle', 'categorySlug', 'limit', 'order', 'isActive', 'articleIds', 'featureCards', 'desktopLayout', 'mobileLayout', 'viewAllLink', 'background', 'spacing']],
    navigation: [NavigationMenu, ['key', 'label', 'location', 'items', 'isActive']]
  };
  const [Model, fields] = models[revision.entityType] || [];
  if (Model) {
    const restoredValue = pickFields(revision.oldValue, fields);
    restored = revision.entityType === 'settings'
      ? await Model.findOneAndUpdate({ key: 'main' }, { $set: restoredValue }, { new: true, runValidators: true })
      : await Model.findByIdAndUpdate(revision.entityId, { $set: restoredValue }, { new: true, runValidators: true });
  }
  if (!restored) return res.status(404).json({ message: 'Entity cannot be restored' });
  await Revision.create({ entityType: revision.entityType, entityId: revision.entityId, action: 'restore', summary: 'Previous revision restored', oldValue: revision.newValue, newValue: revision.oldValue, editor: req.user._id });
  await writeAuditLog(req, 'revision.restore', revision.entityType, revision.entityId, `Previous ${revision.entityType} revision restored`);
  res.json({ restored });
});

router.get('/categories', ...protect('categories:read'), async (req, res) => {
  const filter = {};
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    filter.$or = [
      { name: new RegExp(escapeRegex(search), 'i') },
      { slug: new RegExp(escapeRegex(search), 'i') }
    ];
  }
  if (req.query.status === 'active') filter.isActive = true;
  if (req.query.status === 'archived') filter.isActive = false;
  const [categories, counts] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).lean(),
    Article.aggregate([
      {
        $project: {
          categories: {
            $setUnion: [
              { $cond: [{ $and: [{ $ne: ['$category', null] }, { $ne: ['$category', ''] }] }, ['$category'], []] },
              { $ifNull: ['$additionalCategories', []] }
            ]
          }
        }
      },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } }
    ])
  ]);
  const countByName = new Map(counts.map((item) => [item._id, item.count]));
  res.json({ categories: categories.map((category) => ({ ...category, articleCount: countByName.get(category.name) || 0 })) });
});

router.post('/categories', ...protect('categories:write'), async (req, res) => {
  const input = pickFields(req.body, ['name', 'slug', 'description', 'icon', 'image', 'parentCategory', 'seoTitle', 'seoDescription', 'isActive']);
  if (input.slug !== undefined) input.slug = require('../utils/slugify')(input.slug);
  if (input.parentCategory === '') input.parentCategory = null;
  if (input.parentCategory && (!mongoose.isValidObjectId(input.parentCategory) || !await Category.exists({ _id: input.parentCategory }))) {
    return res.status(400).json({ message: 'Parent category does not exist' });
  }
  const category = await Category.create(input);
  await Revision.create({ entityType: 'category', entityId: category._id, action: 'create', summary: `Category "${category.name}" created`, newValue: category.toObject(), editor: req.user._id });
  await writeAuditLog(req, 'category.create', 'category', category._id, `Category "${category.name}" created`);
  res.status(201).json({ category });
});

router.put('/categories/:id', ...protect('categories:write'), async (req, res) => {
  const input = pickFields(req.body, ['name', 'slug', 'description', 'icon', 'image', 'parentCategory', 'seoTitle', 'seoDescription', 'isActive']);
  if (input.slug !== undefined) input.slug = require('../utils/slugify')(input.slug);
  if (input.parentCategory === '') input.parentCategory = null;
  if (input.parentCategory && String(input.parentCategory) === req.params.id) {
    return res.status(400).json({ message: 'A category cannot be its own parent' });
  }
  if (input.parentCategory && (!mongoose.isValidObjectId(input.parentCategory) || !await Category.exists({ _id: input.parentCategory }))) {
    return res.status(400).json({ message: 'Parent category does not exist' });
  }
  const session = await Category.startSession();
  let category;
  try {
    await session.withTransaction(async () => {
      const before = await Category.findById(req.params.id).session(session);
      if (!before) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
      const articlesInCategory = await Article.countDocuments({
        $or: [{ category: before.name }, { additionalCategories: before.name }]
      }).session(session);
      if (articlesInCategory && input.slug && input.slug !== before.slug) {
        throw Object.assign(new Error('The slug of a category with articles cannot be changed because existing routes must remain valid'), { statusCode: 409 });
      }
      category = await Category.findByIdAndUpdate(req.params.id, input, { new: true, runValidators: true, session });
      if (before.name !== category.name) {
        await Article.updateMany({ category: before.name }, { $set: { category: category.name } }, { session });
        await Article.updateMany(
          { additionalCategories: before.name },
          { $set: { 'additionalCategories.$[oldCategory]': category.name } },
          { arrayFilters: [{ oldCategory: before.name }], session }
        );
      }
      await Revision.create([{
        entityType: 'category',
        entityId: category._id,
        action: 'update',
        summary: `Category "${category.name}" updated`,
        oldValue: before.toObject(),
        newValue: category.toObject(),
        editor: req.user._id
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  if (!category) return res.status(404).json({ message: 'Category not found' });
  await writeAuditLog(req, 'category.update', 'category', category._id, `Category "${category.name}" updated`);
  res.json({ category });
});

router.patch('/categories/:id/status', ...protect('categories:write'), async (req, res) => {
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ message: 'isActive must be a boolean' });
  const before = await Category.findById(req.params.id).lean();
  if (!before) return res.status(404).json({ message: 'Category not found' });
  const category = await Category.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true, runValidators: true });
  await Revision.create({
    entityType: 'category',
    entityId: category._id,
    action: req.body.isActive ? 'restore' : 'archive',
    summary: `Category "${category.name}" ${req.body.isActive ? 'restored' : 'archived'}`,
    oldValue: before,
    newValue: category.toObject(),
    editor: req.user._id
  });
  await writeAuditLog(req, req.body.isActive ? 'category.restore' : 'category.archive', 'category', category._id, `Category "${category.name}" ${req.body.isActive ? 'restored' : 'archived'}`);
  res.json({ category });
});

module.exports = router;
