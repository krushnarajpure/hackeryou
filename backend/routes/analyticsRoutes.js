const express = require('express');
const auth = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/analyticsController');

const router = express.Router();
router.use(auth, requirePermission('analytics:read'));
router.get('/overview', controller.overview);
router.get('/articles', controller.articles);

module.exports = router;
