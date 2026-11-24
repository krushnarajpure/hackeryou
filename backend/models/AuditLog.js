const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  source: { type: String, enum: ['user', 'system'], default: 'user' },
  action: { type: String, required: true, trim: true, maxlength: 80 },
  entityType: { type: String, required: true, trim: true, maxlength: 80, index: true },
  entityId: { type: String, default: '', maxlength: 120 },
  summary: { type: String, default: '', maxlength: 500 }
}, { timestamps: true, autoIndex: false });

module.exports = mongoose.model('AuditLog', auditLogSchema);
