const ArticleAnalytics = require('../models/ArticleAnalytics');
const ArticleVisitor = require('../models/ArticleVisitor');

async function withArticleAnalytics(articles) {
  const records = articles.map((article) => article.toObject ? article.toObject() : { ...article });
  const articleIds = records.map((article) => article._id).filter(Boolean);
  if (!articleIds.length) return records;

  const [analytics, visitorCounts] = await Promise.all([
    ArticleAnalytics.find({ article: { $in: articleIds } }).select('article totalViews').lean(),
    ArticleVisitor.aggregate([
      { $match: { article: { $in: articleIds } } },
      { $group: { _id: '$article', count: { $sum: 1 } } }
    ])
  ]);
  const viewsByArticle = new Map(analytics.map((item) => [String(item.article), item.totalViews || 0]));
  const visitorsByArticle = new Map(visitorCounts.map((item) => [String(item._id), item.count]));

  return records.map((article) => {
    const approvedComments = Array.isArray(article.comments)
      ? article.comments.filter((comment) => comment.status ? comment.status === 'approved' : comment.isApproved !== false).length
      : Number(article.commentCount) || 0;
    delete article.comments;
    article.commentCount = approvedComments;
    article.totalViews = viewsByArticle.get(String(article._id)) || 0;
    article.uniqueVisitors = visitorsByArticle.get(String(article._id)) || 0;
    return article;
  });
}

module.exports = { withArticleAnalytics };
