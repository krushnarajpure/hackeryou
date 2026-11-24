const express = require('express');
const auth = require('../middleware/authMiddleware');
const Promotion = require('../models/Promotion');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  const promotions = await Promotion.find({ user: req.user._id }).populate('relatedBusiness', 'businessName').sort({ createdAt: -1 });
  res.json({ promotions });
});

router.post('/', auth, async (req, res) => {
  if (!req.body.title?.trim() || !req.body.type?.trim()) {
    throw Object.assign(new Error('Promotion title and type are required'), { statusCode: 400 });
  }
  const promotion = await Promotion.create({
    user: req.user._id,
    type: req.body.type,
    title: req.body.title.trim(),
    description: req.body.description?.trim() || '',
    amountPaise: Number(req.body.amountPaise) || 0,
    relatedBusiness: req.body.relatedBusiness || null,
    status: 'draft'
  });
  res.status(201).json({ promotion });
});

module.exports = router;
