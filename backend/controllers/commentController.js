const mongoose = require('mongoose');
const Article = require('../models/Article');
const writeAuditLog = require('../utils/writeAuditLog');

const commentStatusExpression = {
  $ifNull: [
    '$comments.status',
    { $cond: [{ $eq: ['$comments.isApproved', false] }, 'pending', 'approved'] }
  ]
};

exports.listComments = async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 25);
  const status = String(req.query.status || 'all');
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw Object.assign(new Error('Invalid comment pagination'), { statusCode: 400 });
  }
  if (!['all', 'pending', 'approved', 'rejected'].includes(status)) {
    throw Object.assign(new Error('Invalid comment status'), { statusCode: 400 });
  }

  const statusFilter = status === 'all' ? [] : [{ $match: { commentStatus: status } }];
  const [result = { counts: [], comments: [], total: [] }] = await Article.aggregate([
    { $unwind: '$comments' },
    { $addFields: { commentStatus: commentStatusExpression } },
    {
      $facet: {
        counts: [{ $group: { _id: '$commentStatus', total: { $sum: 1 } } }],
        comments: [
          ...statusFilter,
          { $sort: { 'comments.createdAt': -1, _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              comment: {
                _id: '$comments._id',
                name: '$comments.name',
                email: '$comments.email',
                website: '$comments.website',
                message: '$comments.message',
                articleTitle: { $ifNull: ['$comments.articleTitle', '$title'] },
                articleSlug: { $ifNull: ['$comments.articleSlug', '$slug'] },
                createdAt: '$comments.createdAt',
                status: '$commentStatus'
              },
              article: { _id: '$_id', title: '$title', slug: '$slug' }
            }
          }
        ],
        total: [...statusFilter, { $count: 'value' }]
      }
    }
  ]);
  const counts = Object.fromEntries(result.counts.map(({ _id, total }) => [_id, total]));
  res.json({
    comments: result.comments,
    counts: {
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      pending: counts.pending || 0,
      approved: counts.approved || 0,
      rejected: counts.rejected || 0
    },
    pagination: { page, limit, total: result.total[0]?.value || 0, pages: Math.ceil((result.total[0]?.value || 0) / limit) }
  });
};

exports.updateCommentStatus = async (req, res) => {
  const { articleId, commentId } = req.params;
  const { status } = req.body || {};
  if (!mongoose.isValidObjectId(articleId) || !mongoose.isValidObjectId(commentId)) {
    throw Object.assign(new Error('Invalid comment identifier'), { statusCode: 400 });
  }
  if (!['approved', 'rejected'].includes(status)) {
    throw Object.assign(new Error('Status must be approved or rejected'), { statusCode: 400 });
  }
  const result = await Article.updateOne(
    { _id: articleId, 'comments._id': commentId },
    { $set: { 'comments.$.status': status, 'comments.$.isApproved': status === 'approved' } },
    { runValidators: true }
  );
  if (!result.matchedCount) throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
  await writeAuditLog(req, `comment.${status}`, 'comment', commentId, `Comment ${status} for article ${articleId}`);
  res.json({ message: `Comment ${status}`, status });
};

exports.deleteComment = async (req, res) => {
  const { articleId, commentId } = req.params;
  if (!mongoose.isValidObjectId(articleId) || !mongoose.isValidObjectId(commentId)) {
    throw Object.assign(new Error('Invalid comment identifier'), { statusCode: 400 });
  }
  const result = await Article.updateOne(
    { _id: articleId, 'comments._id': commentId },
    { $pull: { comments: { _id: commentId } } }
  );
  if (!result.matchedCount) throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
  await writeAuditLog(req, 'comment.delete', 'comment', commentId, `Comment deleted from article ${articleId}`);
  res.json({ message: 'Comment deleted' });
};
