const mongoose = require('mongoose');

const globalContentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  type: { type: String, enum: ['text', 'html', 'email', 'phone', 'url', 'image'], default: 'text' },
  page: { type: String, default: 'global' },
  component: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'published'], default: 'published' }
}, { timestamps: true });

globalContentSchema.index({ key: 'text', label: 'text', page: 'text', component: 'text' });
module.exports = mongoose.model('GlobalContent', globalContentSchema);
