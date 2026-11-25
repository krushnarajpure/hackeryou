const express = require('express');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const upload = require('../middleware/uploadMiddleware');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');
const controller = require('../controllers/articleController');
const router = express.Router();
const commentSubmissionLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many comments submitted. Please try again later.' }
});
const optionalAuth = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const token = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = { role: token.role };
  } catch (error) {
    if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) return next(error);
  }
  next();
};
router.get('/', controller.getArticles);
router.get('/suggestions', controller.getArticleSuggestions);
router.get('/latest', controller.getLatestArticles);
router.get('/popular', controller.getPopularArticles);
router.get('/related/:slug', controller.getRelatedArticles);
router.get('/homepage', controller.getHomepage);
router.post('/:slug/views', optionalAuth, controller.trackArticleView);
router.post('/:slug/comments', commentSubmissionLimit, [
  param('slug').isString().trim().isLength({ min: 1, max: 180 }),
  body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isString().trim().isEmail().normalizeEmail().isLength({ max: 254 }).withMessage('Enter a valid email address'),
  body('website').optional({ checkFalsy: true }).isString().trim().isLength({ max: 500 }).isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Enter a valid website URL'),
  body('message').isString().trim().isLength({ min: 10, max: 2000 }).withMessage('Comment must be between 10 and 2000 characters'),
  body('company').optional({ checkFalsy: true }).isString().isLength({ max: 200 })
], controller.addArticleComment);
router.get('/slug/:slug', controller.getArticleBySlug);
router.get('/:slug', controller.getArticleBySlug);
router.post('/', auth, requirePermission('articles:write'), upload.single('image'), upload.validateImages, controller.createArticle);
router.put('/:id', auth, requirePermission('articles:write'), upload.single('image'), upload.validateImages, controller.updateArticle);
router.patch('/:id/publish', auth, requirePermission('articles:publish'), controller.publishArticle);
router.patch('/:id/archive', auth, requirePermission('articles:archive'), controller.deleteArticle);
router.patch('/:id/restore', auth, requirePermission('articles:archive'), controller.restoreArticle);
router.delete('/:id', auth, requirePermission('articles:archive'), controller.deleteArticle);
module.exports = router;
