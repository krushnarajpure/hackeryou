const express = require('express');
const NavigationMenu = require('../models/NavigationMenu');
const router = express.Router();

router.get('/', async (req, res) => {
  const location = req.query.location;
  const filter = { isActive: true };
  if (location) filter.location = location;
  const menus = await NavigationMenu.find(filter).sort({ createdAt: 1 });
  res.json({ menus });
});

module.exports = router;
