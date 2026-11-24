const express = require('express');
const Media = require('../models/Media');
const { openMediaFile } = require('../utils/mediaStorage');

const router = express.Router();
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

router.get('/:id/content', async (req, res, next) => {
  const media = await Media.findById(req.params.id).select('gridFsFileId mimeType size').lean();
  if (!media || !media.gridFsFileId) return res.status(404).json({ message: 'Media file not found' });
  if (!allowedTypes.has(media.mimeType)) return res.status(415).json({ message: 'Unsupported media type' });

  res.set({
    'Content-Type': media.mimeType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff'
  });
  if (Number.isSafeInteger(media.size) && media.size > 0) res.set('Content-Length', String(media.size));

  const stream = openMediaFile(media.gridFsFileId);
  stream.once('error', (error) => {
    if (error.codeName === 'FileNotFound' && !res.headersSent) {
      res.status(404).json({ message: 'Media file not found' });
      return;
    }
    if (res.headersSent) res.destroy(error);
    else next(error);
  });
  stream.pipe(res);
});

module.exports = router;
