const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/authMiddleware');
const { hasPermission, requirePermission } = require('../middleware/permissionMiddleware');
const { generateArticle, generateImage, getAiProviderStatus } = require('../services/aiContentService');
const Article = require('../models/Article');
const articleController = require('../controllers/articleController');

const router = express.Router();
router.use(auth, requirePermission('articles:write'), rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'AI विनंत्यांची मर्यादा पूर्ण झाली. थोड्या वेळाने पुन्हा प्रयत्न करा.' }
}));

router.get('/status', (_req, res) => {
  res.json(getAiProviderStatus());
});

router.post('/generate', async (req, res) => {
  const mode = String(req.body.mode || '');
  const prompt = String(req.body.prompt || '').trim();
  const content = String(req.body.content || '').trim();
  res.json(await generateArticle({ mode, prompt, content }));
});

router.post('/image', async (req, res) => {
  const media = await generateImage({
    title: req.body.title,
    content: req.body.content,
    user: req.user
  });
  res.status(201).json({ media });
});

router.put('/articles/:id', async (req, res) => {
  const article = await Article.findById(req.params.id).select('isPublished');
  if (!article) return res.status(404).json({ message: 'Article not found' });
  const permission = article.isPublished ? 'articles:publish' : 'articles:write';
  if (!hasPermission(req.user.role, permission)) {
    return res.status(403).json({ message: 'An administrator must confirm updates to published articles' });
  }
  return articleController.updateArticle(req, res);
});

module.exports = router;
