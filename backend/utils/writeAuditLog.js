const AuditLog = require('../models/AuditLog');

module.exports = async function writeAuditLog(req, action, entityType, entityId, summary) {
  if (!req.user?._id) throw new Error('An authenticated user is required for audit logging');
  return AuditLog.create({
    actor: req.user._id,
    action,
    entityType,
    entityId: entityId ? String(entityId) : '',
    summary: String(summary || '').slice(0, 500)
  });
};
