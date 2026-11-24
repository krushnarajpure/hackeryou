const express = require('express');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const upload = require('../middleware/uploadMiddleware');
const controller = require('../controllers/articleController');
const router = express.Router();
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
router.post('/:slug/comments', controller.addArticleComment);
router.get('/slug/:slug', controller.getArticleBySlug);
router.get('/:slug', controller.getArticleBySlug);
router.post('/', auth, requirePermission('articles:write'), upload.single('image'), upload.validateImages, controller.createArticle);
router.put('/:id', auth, requirePermission('articles:write'), upload.single('image'), upload.validateImages, controller.updateArticle);
router.patch('/:id/publish', auth, requirePermission('articles:publish'), controller.publishArticle);
router.patch('/:id/archive', auth, requirePermission('articles:archive'), controller.deleteArticle);
router.patch('/:id/restore', auth, requirePermission('articles:archive'), controller.restoreArticle);
router.delete('/:id', auth, requirePermission('articles:archive'), controller.deleteArticle);
module.exports = router;
