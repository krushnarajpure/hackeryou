const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema({
  entityType: { type: String, required: true, index: true },
  entityId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  action: { type: String, default: 'update' },
  summary: { type: String, default: '' },
  oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  editor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Revision', revisionSchema);
