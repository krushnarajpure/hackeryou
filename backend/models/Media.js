const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  title: { type: String, default: '', trim: true },
  altText: { type: String, default: '', trim: true },
  caption: { type: String, default: '' },
  filename: { type: String, required: true, unique: true, trim: true },
  originalName: { type: String, default: '' },
  gridFsFileId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  mediaType: { type: String, default: 'image' },
  isTrashed: { type: Boolean, default: false },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  url: { type: String, required: true },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  width: { type: Number, default: null },
  height: { type: Number, default: null },
  usages: [{ type: mongoose.Schema.Types.Mixed }]
}, { timestamps: true });

mediaSchema.index({ title: 'text', altText: 'text', caption: 'text' });
module.exports = mongoose.model('Media', mediaSchema);
