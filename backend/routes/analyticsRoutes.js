const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const auth = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/analyticsController');

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

router.post('/pageview', optionalAuth, rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}), [
  body('visitorId').isString().trim().matches(/^[a-zA-Z0-9._-]{16,128}$/).withMessage('Valid anonymous visitor identifier required'),
  body('path').isString().trim().isLength({ min: 1, max: 500 }).custom((value) => (
    typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
      && !/[?#\\]/.test(value) && !value.split('').some((character) => character.charCodeAt(0) < 32)
  )).withMessage('Valid page path required'),
  body('title').optional().isString().trim().isLength({ max: 200 })
], controller.trackPageView);

router.use(auth, requirePermission('analytics:read'));
router.get('/overview', controller.overview);
router.get('/articles', controller.articles);

module.exports = router;
