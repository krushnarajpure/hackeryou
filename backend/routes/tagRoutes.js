const express = require('express');
const Tag = require('../models/Tag');

const router = express.Router();

router.get('/', async (_req, res) => {
  const tags = await Tag.find({ isActive: true }).select('name slug').sort({ name: 1 }).limit(100).lean();
  res.json({ tags });
});

module.exports = router;
