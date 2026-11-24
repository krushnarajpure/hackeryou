require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const publicSiteUrl = 'https://expressudyojak.vercel.app';

app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", 'https://checkout.razorpay.com'],
      'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
      'connect-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com']
    }
  }
}));
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buffer) => {
    if (['/api/payments/webhook', '/api/store/webhook'].includes(req.originalUrl)) req.rawBody = buffer;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));
app.use('/api', rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX) || 3000,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { fallthrough: false }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: 'connected' }));
app.get('/api/homepage', require('./controllers/articleController').getHomepage);
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *
Allow: /

Sitemap: ${publicSiteUrl}/sitemap.xml
`);
});
app.get('/sitemap.xml', async (_req, res, next) => {
  try {
    const Article = require('./models/Article');
    const Category = require('./models/Category');
    const BusinessIdea = require('./models/BusinessIdea');
    const Scheme = require('./models/GovernmentScheme');
    const Story = require('./models/SuccessStory');
    const Page = require('./models/Page');
    const Book = require('./models/Book');
    const Business = require('./models/Business');
    const escapeXml = (value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    const isoDate = (value) => {
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    };

    const [articles, categories, ideas, schemes, stories, pages, books, businesses] = await Promise.all([
      Article.find({ isPublished: true }).select('slug updatedAt').sort({ updatedAt: -1 }),
      Category.find({ isActive: true }).select('slug updatedAt'),
      BusinessIdea.find({ isPublished: true }).select('slug updatedAt'),
      Scheme.find({ isActive: true }).select('slug updatedAt'),
      Story.find({ isPublished: true }).select('slug updatedAt'),
      Page.find({ isPublished: true }).select('slug updatedAt'),
      Book.find({ status: 'published' }).select('slug updatedAt'),
      Business.find({ approvalStatus: 'approved' }).select('slug updatedAt')
    ]);

    const staticPaths = [
      '/',
      '/business-ideas',
      '/guidance',
      '/business-loans',
      '/schemes',
      '/stories',
      '/articles',
      '/business-licenses',
      '/business-setup',
      '/government-schemes',
      '/machinery-equipment',
      '/franchise-opportunities',
      '/directory',
      '/about-us',
      '/contact-us',
      '/faq',
      '/privacy-policy',
      '/terms-and-conditions',
      '/dmca-notice',
      '/affiliate-disclosure-marathi-udyojak',
      '/books'
    ];
    const entries = staticPaths.map((pathname) => ({ loc: `${publicSiteUrl}${pathname}`, lastmod: null }));
    articles.forEach((article) => article.slug && entries.push({ loc: `${publicSiteUrl}/articles/${article.slug}`, lastmod: isoDate(article.updatedAt) }));
    categories.forEach((category) => category.slug && category.slug !== 'business-loans' && entries.push({ loc: `${publicSiteUrl}/category/${category.slug}`, lastmod: isoDate(category.updatedAt) }));
    ideas.forEach((idea) => idea.slug && entries.push({ loc: `${publicSiteUrl}/business-ideas/${idea.slug}`, lastmod: isoDate(idea.updatedAt) }));
    schemes.forEach((scheme) => scheme.slug && entries.push({ loc: `${publicSiteUrl}/schemes/${scheme.slug}`, lastmod: isoDate(scheme.updatedAt) }));
    stories.forEach((story) => story.slug && entries.push({ loc: `${publicSiteUrl}/stories/${story.slug}`, lastmod: isoDate(story.updatedAt) }));
    pages.forEach((page) => page.slug && entries.push({ loc: `${publicSiteUrl}/page/${page.slug}`, lastmod: isoDate(page.updatedAt) }));
    books.forEach((book) => book.slug && entries.push({ loc: `${publicSiteUrl}/books/${book.slug}`, lastmod: isoDate(book.updatedAt) }));
    businesses.forEach((business) => business.slug && entries.push({ loc: `${publicSiteUrl}/directory/${business.slug}`, lastmod: isoDate(business.updatedAt) }));

    const uniqueEntries = Array.from(new Map(entries.map((entry) => [entry.loc, entry])).values());
    const urls = uniqueEntries.map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : '';
      return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}</url>`;
    }).join('');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  } catch (error) {
    next(error);
  }
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/businesses', require('./routes/businessRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/tags', require('./routes/tagRoutes'));
app.use('/api/navigation', require('./routes/navigationRoutes'));
app.use('/api/pages', require('./routes/pageRoutes'));
app.use('/api/business-ideas', require('./routes/businessIdeaRoutes'));
app.use('/api/schemes', require('./routes/schemeRoutes'));
app.use('/api/stories', require('./routes/successStoryRoutes'));
app.use('/api/articles', require('./routes/articleRoutes'));
app.use('/api/media', require('./routes/mediaRoutes'));
app.use('/api/enquiries', require('./routes/enquiryRoutes'));
app.use('/api/advertisements', require('./routes/advertisementRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/store', require('./routes/storeRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/promotions', require('./routes/promotionRoutes'));
app.use('/api/cms', require('./routes/cmsRoutes'));
app.use('/api/ai-content', require('./routes/aiContentRoutes'));

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 5000;
const startServer = async () => {
  let reservationTimer;
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
    await connectDB();
    const expirePendingOrders = require('./controllers/storeController').expirePendingOrders;
    const publishDueArticles = require('./utils/articleScheduler').publishDueArticles;
    reservationTimer = setInterval(() => {
      expirePendingOrders().catch((error) => console.error(`Book-order reservation cleanup failed: ${error.message}`));
      publishDueArticles().catch((error) => console.error(`Scheduled article publishing failed: ${error.message}`));
    }, 60 * 1000);
    reservationTimer.unref();
    const server = app.listen(port, () => console.log(`Marathi Udyojak API listening on port ${port}`));
    const shutdown = (signal) => {
      console.log(`${signal} received; closing server`);
      if (reservationTimer) clearInterval(reservationTimer);
      server.close(async () => {
        await require('mongoose').disconnect();
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

if (require.main === module) startServer();
module.exports = { app, startServer };
