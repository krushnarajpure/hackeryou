const mongoose = require('mongoose');

const navigationItemSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  to: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  children: [{ type: mongoose.Schema.Types.Mixed }]
}, { _id: false });

const navigationMenuSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, default: '' },
  location: { type: String, enum: ['header', 'footer', 'mobile'], default: 'header' },
  items: [navigationItemSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('NavigationMenu', navigationMenuSchema);
