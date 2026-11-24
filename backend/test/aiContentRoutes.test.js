const assert = require('node:assert/strict');
const { test } = require('node:test');
const Article = require('../models/Article');
const articleController = require('../controllers/articleController');
const router = require('../routes/aiContentRoutes');

const updateHandler = router.stack
  .find((layer) => layer.route?.path === '/articles/:id')
  .route.stack[0].handle;

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('AI updates require publish permission for published articles', async () => {
  const originalFindById = Article.findById;
  const originalUpdate = articleController.updateArticle;
  let updateCalled = false;
  Article.findById = () => ({ select: async () => ({ isPublished: true }) });
  articleController.updateArticle = async (_req, res) => {
    updateCalled = true;
    res.json({ article: { _id: 'article-id' } });
  };

  try {
    const denied = response();
    await updateHandler({ params: { id: 'article-id' }, user: { role: 'content_editor' } }, denied);
    assert.equal(denied.statusCode, 403);
    assert.equal(updateCalled, false);

    const allowed = response();
    await updateHandler({ params: { id: 'article-id' }, user: { role: 'admin' } }, allowed);
    assert.equal(allowed.statusCode, 200);
    assert.equal(updateCalled, true);
  } finally {
    Article.findById = originalFindById;
    articleController.updateArticle = originalUpdate;
  }
});
