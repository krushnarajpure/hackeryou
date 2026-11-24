const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const extensionByMime = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extensionByMime[file.mimetype] || path.extname(file.originalname).toLowerCase()}`);
  }
});

const fileFilter = (_req, file, callback) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
    return callback(Object.assign(new Error('Only JPG, PNG and WEBP images are allowed'), { statusCode: 400 }));
  }
  callback(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024, files: 8 } });
const matchesImageSignature = (mimeType, bytes) => {
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
};

upload.validateImages = async (req, _res, next) => {
  const files = [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())].filter(Boolean);
  if (!files.length) return next();
  const invalidFiles = [];
  try {
    for (const file of files) {
      const handle = await fs.promises.open(file.path, 'r');
      try {
        const bytes = Buffer.alloc(12);
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
        if (!matchesImageSignature(file.mimetype, bytes.subarray(0, bytesRead))) invalidFiles.push(file.path);
      } finally {
        await handle.close();
      }
    }
    if (invalidFiles.length) {
      await Promise.all(files.map((file) => fs.promises.unlink(file.path)));
      return next(Object.assign(new Error('Uploaded file contents do not match an allowed image type'), { statusCode: 400 }));
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = upload;
