const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, lowercase: true, trim: true },
  author: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 12000 },
  language: { type: String, default: 'Marathi', trim: true, maxlength: 40 },
  isbn: { type: String, default: '', trim: true, maxlength: 20 },
  category: { type: String, default: '', trim: true, maxlength: 100 },
  coverImage: { type: String, default: '' },
  productType: { type: String, enum: ['physical', 'digital'], default: 'physical' },
  pricePaise: { type: Number, required: true, min: 0 },
  salePricePaise: { type: Number, default: null, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  reservedStock: { type: Number, default: 0, min: 0 },
  sku: { type: String, default: '', trim: true, maxlength: 80 },
  shippingWeightGrams: { type: Number, default: 0, min: 0 },
  digitalFileUrl: { type: String, default: '', select: false },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  seoTitle: { type: String, default: '', maxlength: 180 },
  seoDescription: { type: String, default: '', maxlength: 500 },
  editor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, autoIndex: false });

module.exports = mongoose.model('Book', bookSchema);
