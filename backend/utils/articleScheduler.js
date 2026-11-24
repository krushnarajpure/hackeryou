const Article = require('../models/Article');
const Revision = require('../models/Revision');
const AuditLog = require('../models/AuditLog');

async function publishDueArticles(now = new Date()) {
  const dueArticles = await Article.find({
    isPublished: false,
    archivedAt: null,
    scheduledAt: { $lte: now }
  }).select('_id title scheduledAt').limit(50).lean();

  for (const due of dueArticles) {
    const article = await Article.findOneAndUpdate({
      _id: due._id,
      isPublished: false,
      archivedAt: null,
      scheduledAt: { $lte: now }
    }, {
      $set: { isPublished: true, publicationDate: due.scheduledAt },
      $unset: { scheduledAt: '' }
    }, { new: true, runValidators: true });
    if (!article) continue;
    await Revision.create({
      entityType: 'article',
      entityId: article._id,
      action: 'scheduled-publish',
      summary: `Scheduled article "${article.title}" published`,
      oldValue: { isPublished: false, scheduledAt: due.scheduledAt },
      newValue: { isPublished: true, publicationDate: article.publicationDate }
    });
    await AuditLog.create({
      source: 'system',
      action: 'article.scheduled_publish',
      entityType: 'article',
      entityId: String(article._id),
      summary: `Scheduled article "${article.title}" published`
    });
  }
  return dueArticles.length;
}

module.exports = { publishDueArticles };
