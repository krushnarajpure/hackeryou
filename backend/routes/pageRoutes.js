const express = require('express');
const Page = require('../models/Page');
const router = express.Router();

router.get('/', async (_req, res) => {
  const pages = await Page.find({ isPublished: true }).sort({ title: 1 }).select('title slug subtitle excerpt featuredImage canonicalUrl');
  res.json({ pages });
});

router.get('/:slug', async (req, res) => {
  const page = await Page.findOne({ slug: req.params.slug, isPublished: true });
  if (!page) return res.status(404).json({ message: 'Page not found' });
  res.json({ page });
});

module.exports = router;
