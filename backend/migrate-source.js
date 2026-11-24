require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Article = require('./models/Article');
const Category = require('./models/Category');
const Tag = require('./models/Tag');
const HomepageSection = require('./models/HomepageSection');
const User = require('./models/User');
const Page = require('./models/Page');
const NavigationMenu = require('./models/NavigationMenu');

const SOURCE = 'https://marathiudyojak.com';
const stateFile = path.join(__dirname, 'migration-state.json');
const reportFile = path.join(__dirname, 'migration-report.json');
const inventoryFile = path.resolve(__dirname, '..', 'reports', 'source-inventory.json');
const updateExistingSourceContent = process.argv.includes('--update-existing-source-content');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stripHtml = (value = '') => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#8217;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const slugify = (value = '') => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function fetchJson(url, attempt = 1) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { data: await response.json(), response };
  } catch (error) {
    if (attempt >= 4) throw error;
    await sleep(attempt * 1500);
    return fetchJson(url, attempt + 1);
  }
}

async function fetchText(url, attempt = 1) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    if (attempt >= 4) throw error;
    await sleep(attempt * 1500);
    return fetchText(url, attempt + 1);
  }
}

async function inspectRestCollection(endpoint) {
  let page = 1;
  let total = 0;
  let totalPages = 1;
  const urls = [];
  while (page <= totalPages) {
    const { data, response } = await fetchJson(`${SOURCE}${endpoint}?per_page=100&page=${page}&_fields=id,slug,link`);
    if (page === 1) {
      total = Number(response.headers.get('x-wp-total')) || data.length;
      totalPages = Number(response.headers.get('x-wp-totalpages')) || 1;
    }
    urls.push(...data.map((item) => ({ id: item.id, slug: item.slug, url: item.link })));
    page += 1;
  }
  return { status: 200, total, pages: totalPages, urls };
}

async function inspectEndpoint(endpoint) {
  try {
    const response = await fetch(`${SOURCE}${endpoint}`);
    return {
      status: response.status,
      total: Number(response.headers.get('x-wp-total')) || null,
      error: response.ok ? undefined : (await response.text()).slice(0, 200),
    };
  } catch (error) {
    return { status: null, error: error.message };
  }
}

async function inspectSitemap(file) {
  const url = `${SOURCE}/${file}`;
  try {
    const xml = await fetchText(url);
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    return { url, status: 200, count: urls.length, urls };
  } catch (error) {
    return { url, status: null, count: 0, urls: [], error: error.message };
  }
}

async function writeSourceInventory() {
  const [posts, pages, categories, tags] = await Promise.all([
    inspectRestCollection('/wp-json/wp/v2/posts'),
    inspectRestCollection('/wp-json/wp/v2/pages'),
    inspectRestCollection('/wp-json/wp/v2/categories'),
    inspectRestCollection('/wp-json/wp/v2/tags'),
  ]);
  const sitemapFiles = ['sitemap.xml', 'sitemap_index.xml', 'post-sitemap.xml', 'page-sitemap.xml', 'category-sitemap.xml', 'post_tag-sitemap.xml', 'author-sitemap.xml'];
  const sitemaps = [];
  for (const file of sitemapFiles) sitemaps.push(await inspectSitemap(file));
  const sitemapUrls = [...new Set(sitemaps
    .filter(({ url }) => !/\/(?:sitemap\.xml|sitemap_index\.xml)$/.test(url))
    .flatMap((sitemap) => sitemap.urls))];
  const inventory = {
    auditedAt: new Date().toISOString(),
    source: SOURCE,
    rights: 'Content and image reuse authorization not confirmed; metadata-only inventory.',
    restApi: {
      posts: { total: posts.total, pages: posts.pages },
      pages: { total: pages.total, pages: pages.pages },
      categories: { total: categories.total, pages: categories.pages },
      tags: { total: tags.total, pages: tags.pages },
      users: await inspectEndpoint('/wp-json/wp/v2/users?per_page=1'),
      menus: await inspectEndpoint('/wp-json/wp/v2/menus?per_page=1'),
    },
    sitemapCounts: Object.fromEntries(sitemaps.map(({ url, count, status, error }) => [new URL(url).pathname, { status, count, error }])),
    sitemapUrls,
    records: { posts: posts.urls, pages: pages.urls, categories: categories.urls, tags: tags.urls },
    contentBodiesCopied: false,
    imagesDownloaded: 0,
  };
  fs.mkdirSync(path.dirname(inventoryFile), { recursive: true });
  fs.writeFileSync(inventoryFile, JSON.stringify(inventory, null, 2));
  console.log(JSON.stringify({
    report: inventoryFile,
    restApi: inventory.restApi,
    sitemapCounts: inventory.sitemapCounts,
    uniqueSitemapUrls: sitemapUrls.length,
    contentBodiesCopied: false,
  }, null, 2));
}

async function seedCategories() {
  const { data: categories, response } = await fetchJson(`${SOURCE}/wp-json/wp/v2/categories?per_page=100&page=1&_fields=id,name,slug,count,description`);
  const report = { discovered: categories.length, created: 0, updated: 0, duplicatesSkipped: 0, failed: [] };
  for (const item of categories) {
    try {
      const existing = await Category.findOne({ slug: item.slug });
      if (existing && !updateExistingSourceContent) {
        report.duplicatesSkipped += 1;
        continue;
      }
      await Category.findOneAndUpdate(
        { slug: item.slug },
        { name: item.name, slug: item.slug, description: item.description || '', isActive: true },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      if (existing) report.updated += 1; else report.created += 1;
    } catch (error) {
      report.failed.push({ slug: item.slug, reason: error.message });
    }
  }
  return { categories, report };
}

function loadState() {
  if (!fs.existsSync(stateFile)) return { processedSlugs: [], lastPage: 1 };
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
  catch { return { processedSlugs: [], lastPage: 1 }; }
}

function saveState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

async function migratePosts(admin) {
  const state = process.argv.includes('--reset') ? { processedSlugs: [], lastPage: 1 } : loadState();
  const report = {
    totalDiscovered: 0,
    migrated: 0,
    duplicatesSkipped: 0,
    protectedExistingSkipped: 0,
    failed: [],
    imageUrlsDiscovered: 0,
    imagesProcessed: 0,
  };
  let page = state.lastPage || 1;

  while (true) {
    let payload;
    try {
      const result = await fetchJson(`${SOURCE}/wp-json/wp/v2/posts?per_page=100&page=${page}&_embed=1`);
      payload = result.data;
      const totalPages = Number(result.response.headers.get('x-wp-totalpages') || 1);
      report.totalDiscovered += payload.length;
      if (!payload.length) break;

      for (const post of payload) {
        if (state.processedSlugs.includes(post.slug)) continue;
        try {
          const sourceUrl = post.link || `${SOURCE}/${post.slug}/`;
          const existing = await Article.findOne({ $or: [{ slug: post.slug }, { sourceUrl }] });
          if (existing && existing.sourceUrl !== sourceUrl) {
            report.protectedExistingSkipped += 1;
            state.processedSlugs.push(post.slug);
            continue;
          }
          if (existing && !updateExistingSourceContent) {
            report.duplicatesSkipped += 1;
            state.processedSlugs.push(post.slug);
            continue;
          }
          const title = stripHtml(post.title?.rendered || '');
          const subtitle = stripHtml(post.excerpt?.rendered || '').slice(0, 500);
          const content = post.content?.rendered || '';
          const plainText = stripHtml(content);
          const excerpt = subtitle || plainText.slice(0, 260);
          const embedded = post._embedded || {};
          const featured = embedded['wp:featuredmedia']?.[0];
          const featuredImage = featured?.source_url || featured?.media_details?.sizes?.large?.source_url || '';
          const termGroups = embedded['wp:term'] || [];
          const categoryItem = termGroups.flat().find((term) => term.taxonomy === 'category');
          const tagItems = termGroups.flat().filter((term) => term.taxonomy === 'post_tag');
          const category = categoryItem?.name || 'General';

          for (const tagItem of tagItems) {
            await Tag.findOneAndUpdate(
              { slug: tagItem.slug },
              { name: tagItem.name, slug: tagItem.slug, isActive: true },
              { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );
          }

          const imageMatches = [...content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
          const images = [...new Set([featuredImage, ...imageMatches].filter(Boolean))];
          report.imageUrlsDiscovered += images.length;

          await Article.findOneAndUpdate(
            { slug: post.slug },
            {
              title,
              slug: post.slug,
              subtitle,
              content,
              excerpt,
              author: admin._id,
              authorName: 'मराठी उद्योजक',
              category,
              image: featuredImage,
              featuredImage,
              images,
              sourceUrl,
              canonicalUrl: sourceUrl,
              ogImage: featuredImage,
              tags: tagItems.map((tag) => tag.name),
              keywords: tagItems.map((tag) => tag.name),
              seoTitle: post.yoast_head_json?.title || title,
              seoDescription: post.yoast_head_json?.description || excerpt,
              publicationDate: post.date ? new Date(post.date) : null,
              isPublished: post.status === 'publish',
              readingTime: Math.max(1, Math.ceil(plainText.split(/\s+/).length / 220)),
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
          );
          if (existing?.sourceUrl === sourceUrl) report.duplicatesSkipped += 1;
          else report.migrated += 1;
          state.processedSlugs.push(post.slug);
        } catch (error) {
          report.failed.push({ slug: post.slug, reason: error.message });
        }
      }

      state.lastPage = page;
      saveState(state);
      if (page >= Number(result.response.headers.get('x-wp-totalpages') || 1)) break;
      page += 1;
      await sleep(300);
    } catch (error) {
      report.failed.push({ page, reason: error.message });
      state.lastPage = page;
      saveState(state);
      break;
    }
  }
  return report;
}

async function seedHomepageSections(categories) {
  const desired = [
    ['latest-posts', 'नवीन पोस्ट्स', '', 12],
    ['entrepreneurship', 'उद्योजकता', 'entrepreneurship', 6],
    ['government-schemes', 'सरकारी योजना', 'sarkari-yojana', 6],
    ['online-income', 'ऑनलाईन कमाई', 'online-income', 6],
    ['blogging-tips', 'Blogging Tips', 'blogging-tips', 6],
    ['business-tools', 'व्यवसाय टूल्स', 'business-tools', 6],
    ['business-motivation', 'उद्योग मोटिवेशन', 'business-motivation-startup-motivation', 6],
    ['technology', 'तंत्रज्ञान', 'technology', 6],
    ['farming-business', 'शेती उद्योग', 'farming-business', 6],
    ['startup-stories', 'Startup Stories', 'startup-story', 6],
  ];
  for (const [key, title, categorySlug, limit] of desired) {
    await HomepageSection.findOneAndUpdate(
      { key },
      { $setOnInsert: { key, title, categorySlug, limit, order: desired.findIndex((item) => item[0] === key), isActive: true } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }
  return desired.length;
}

async function migratePages() {
  const report = { discovered: 0, migrated: 0, duplicatesSkipped: 0, protectedExistingSkipped: 0, failed: [] };
  const { data: pages } = await fetchJson(`${SOURCE}/wp-json/wp/v2/pages?per_page=100&page=1&_fields=id,slug,link,title,excerpt,content,featured_media,yoast_head_json`);
  report.discovered = pages.length;
  for (const item of pages) {
    try {
      const sourceUrl = item.link || `${SOURCE}/${item.slug}/`;
      const existing = await Page.findOne({ $or: [{ slug: item.slug }, { sourceUrl }] });
      if (existing && existing.sourceUrl !== sourceUrl) {
        report.protectedExistingSkipped += 1;
        continue;
      }
      if (existing && !updateExistingSourceContent) {
        report.duplicatesSkipped += 1;
        continue;
      }
      const title = stripHtml(item.title?.rendered || item.slug);
      await Page.findOneAndUpdate(
        { slug: item.slug },
        {
          title,
          slug: item.slug,
          subtitle: stripHtml(item.excerpt?.rendered || '').slice(0, 500),
          content: item.content?.rendered || '',
          excerpt: stripHtml(item.excerpt?.rendered || '').slice(0, 260),
          sourceUrl,
          canonicalUrl: sourceUrl,
          seoTitle: item.yoast_head_json?.title || title,
          seoDescription: item.yoast_head_json?.description || '',
          pageType: 'page',
          status: item.status === 'publish' ? 'published' : 'draft',
          isPublished: item.status === 'publish'
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      if (existing) report.duplicatesSkipped += 1;
      else report.migrated += 1;
    } catch (error) {
      report.failed.push({ slug: item.slug, reason: error.message });
    }
  }
  return report;
}

async function seedNavigation() {
  const followChildren = [
    { label: 'Facebook', to: 'https://www.facebook.com/marathiudyojakcom' },
    { label: 'X', to: 'https://x.com/MUdyojak' },
    { label: 'YouTube', to: 'https://www.youtube.com/@marathiudyojak_com' },
    { label: 'Instagram', to: 'https://www.instagram.com/marathiudyojak_com/' },
    { label: 'WhatsApp', to: 'https://wa.me/8169758384?text=%E0%A4%A8%E0%A4%AE%E0%A4%B8%E0%A5%8D%E0%A4%95%E0%A4%BE%E0%A4%B0%20%E0%A4%AE%E0%A5%80%20%E0%A4%B6%E0%A5%87%E0%A4%A4%E0%A4%95%E0%A4%B0%E0%A5%80%20!!!' },
  ];
  const items = [
    { label: 'Home', to: '/', order: 1 },
    {
      label: 'उद्योजकता',
      to: '/category/entrepreneurship',
      order: 2
    },
    {
      label: 'उद्योग मोटिवेशन',
      to: '/category/business-motivation-startup-motivation',
      order: 3,
      children: [
        { label: 'स्वतःची डेव्हलोपमेंट', to: '/category/personality-development' },
        { label: 'पुस्तक सारांश', to: '/category/books' },
        { label: 'सुविचार', to: '/category/quotes-suvichar' },
        { label: 'पर्सनल वेल्थ', to: '/category/personal-wealth' }
      ]
    },
    {
      label: 'तंत्रज्ञान',
      to: '/category/technology',
      order: 4,
      children: [
        { label: 'ई-कॉमर्स', to: '/category/e-commerce' },
        { label: 'ब्लॉगिंग', to: '/category/blogging' }
      ]
    },
    { label: 'शेअर मार्केट', to: '/category/share-market', order: 5 },
    { label: 'शेती उद्योग', to: '/category/farming-business', order: 6 },
    { label: 'स्टार्टअप Story', to: '/category/startup-story', order: 7 },
    { label: 'Follow', to: '/contact', order: 8, children: followChildren },
    { label: 'Search', to: '/search', order: 9 }
  ];
  const menu = await NavigationMenu.findOne({ key: 'main-header' });
  if (!menu) {
    await NavigationMenu.create({ key: 'main-header', label: 'Main Navigation', location: 'header', items, isActive: true });
  } else {
    const followItem = menu.items.find((item) => item.label === 'Follow');
    if (followItem) followItem.children = followChildren;
    else menu.items.push({ label: 'Follow', to: '/contact', order: 8, children: followChildren });
    const homeItem = menu.items.find((item) => item.to === '/');
    if (homeItem) homeItem.label = 'Home';
    const startupItem = menu.items.find((item) => item.to === '/category/startup-story');
    if (startupItem) startupItem.label = 'स्टार्टअप Story';
    const searchItem = menu.items.find((item) => item.label === 'Search');
    if (searchItem) searchItem.to = '/search';
    await menu.save();
  }
  return items.length;
}

async function main() {
  if (process.argv.includes('--inventory-only')) {
    await writeSourceInventory();
    return;
  }
  if (!process.argv.includes('--navigation-only') && !process.argv.includes('--confirm-content-rights')) {
    throw new Error('Content reuse is not confirmed. Run with --confirm-content-rights only after verifying authorization; use --inventory-only for metadata-only discovery.');
  }
  await connectDB();
  if (process.argv.includes('--navigation-only')) {
    const navigationItems = await seedNavigation();
    console.log(JSON.stringify({ navigationItems }, null, 2));
    await mongoose.disconnect();
    return;
  }
  let admin = await User.findOne({ email: process.env.ADMIN_EMAIL });
  if (!admin) {
    admin = await User.create({
      name: process.env.ADMIN_NAME || 'Marathi Udyojak Admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
      isActive: true,
    });
  }
  const categoryResult = await seedCategories();
  const postReport = await migratePosts(admin);
  const sectionCount = await seedHomepageSections(categoryResult.categories);
  const pageReport = await migratePages();
  const navigationCount = await seedNavigation();
  const report = {
    completedAt: new Date().toISOString(),
    source: SOURCE,
    categories: categoryResult.report,
    posts: postReport,
    pages: pageReport,
    navigationItems: navigationCount,
    homepageSections: sectionCount,
  };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
