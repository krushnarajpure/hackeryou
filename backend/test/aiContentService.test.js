const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { test } = require('node:test');
const Category = require('../models/Category');
const Media = require('../models/Media');
const AuditLog = require('../models/AuditLog');
const mediaStorage = require('../utils/mediaStorage');
const { generateArticle, generateImage, getAiProviderStatus, markdownToHtml } = require('../services/aiContentService');

test('AI article Markdown is rendered with escaped text, lists, and tables', () => {
  const html = markdownToHtml([
    '# व्यवसाय मार्गदर्शक',
    '',
    'मजकूर <script>alert(1)</script>',
    '',
    '- पहिला मुद्दा',
    '- दुसरा मुद्दा',
    '',
    '| बाब | माहिती |',
    '| --- | --- |',
    '| खर्च | ₹१०० |'
  ].join('\n'));

  assert.match(html, /<h2>व्यवसाय मार्गदर्शक<\/h2>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<ul>\s*<li>पहिला मुद्दा<\/li>\s*<li>दुसरा मुद्दा<\/li>\s*<\/ul>/);
  assert.match(html, /<table><thead>/);
  assert.match(html, /<td>₹१००<\/td>/);
});

test('AI article drafting uses the server-side model and converts safe article content', async () => {
  const originalFind = Category.find;
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  let requestUrl = '';
  let requestBody;
  Category.find = () => ({
    select() { return this; },
    limit() { return this; },
    lean: async () => [{ name: 'Farming Business', slug: 'farming-business' }]
  });
  global.fetch = async (url, options) => {
    requestUrl = url;
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        output_text: JSON.stringify({
          title: 'मशरूम व्यवसाय',
          slug: 'mushroom-business',
          subtitle: '',
          excerpt: 'मशरूम व्यवसायाची प्राथमिक माहिती.',
          contentMarkdown: '# सुरुवात\n\nमशरूम व्यवसायाची माहिती.',
          seoTitle: 'मशरूम व्यवसाय मार्गदर्शक',
          seoDescription: 'मशरूम व्यवसायाबद्दल माहिती.',
          category: 'Farming Business',
          tags: ['मशरूम'],
          faqs: [{ question: 'काय आवश्यक आहे?', answer: 'योग्य नियोजन.' }],
          sources: [{ title: 'Official source', url: 'https://example.gov.in/guide' }]
        })
      })
    };
  };
  delete process.env.GEMINI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-server-key';

  try {
    const result = await generateArticle({ mode: 'create', prompt: 'मशरूम व्यवसायावर लेख लिहा', content: '' });
    assert.equal(requestUrl, 'https://api.openai.com/v1/responses');
    assert.equal(requestBody.tools[0].type, 'web_search_preview');
    assert.equal(result.article.category, 'Farming Business');
    assert.match(result.article.content, /वारंवार विचारले जाणारे प्रश्न/);
    assert.match(result.article.content, /href="https:\/\/example\.gov\.in\/guide"/);
  } finally {
    Category.find = originalFind;
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalGeminiApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
});

test('AI article drafting prefers Gemini, keeps the key server-side, and preserves search citations', async () => {
  const originalFind = Category.find;
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const article = {
    title: 'मशरूम व्यवसाय',
    slug: 'mushroom-business',
    subtitle: '',
    excerpt: 'मशरूम व्यवसायाची प्राथमिक माहिती.',
    contentMarkdown: '# सुरुवात\n\nमशरूम व्यवसायाची माहिती.',
    seoTitle: 'मशरूम व्यवसाय मार्गदर्शक',
    seoDescription: 'मशरूम व्यवसायाबद्दल माहिती.',
    category: 'Farming Business',
    tags: ['मशरूम'],
    faqs: [],
    sources: []
  };
  let requestUrl = '';
  let requestOptions;
  process.env.GEMINI_API_KEY = 'test-gemini-server-key';
  delete process.env.OPENAI_API_KEY;
  Category.find = () => ({
    select() { return this; },
    limit() { return this; },
    lean: async () => [{ name: 'Farming Business', slug: 'farming-business' }]
  });
  global.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        output_text: JSON.stringify(article),
        steps: [{
          type: 'model_output',
          content: [{
            type: 'text',
            annotations: [{
              type: 'url_citation',
              title: 'Government source',
              url: 'https://example.gov.in/mushroom'
            }]
          }]
        }]
      })
    };
  };

  try {
    const result = await generateArticle({ mode: 'create', prompt: 'मशरूम व्यवसायावर लेख लिहा', content: '' });
    const requestBody = JSON.parse(requestOptions.body);
    assert.equal(requestUrl, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(requestOptions.headers['x-goog-api-key'], 'test-gemini-server-key');
    assert.equal(requestBody.model, 'gemini-3.5-flash-lite');
    assert.equal(requestBody.tools[0].type, 'google_search');
    assert.equal(requestBody.response_format.mime_type, 'application/json');
    assert.equal(requestBody.store, false);
    assert.deepEqual(result.sources, [{ title: 'Government source', url: 'https://example.gov.in/mushroom' }]);
    assert.deepEqual(getAiProviderStatus(), {
      provider: 'Gemini',
      configured: true,
      imageConfigured: true,
      model: 'gemini-3.5-flash-lite'
    });
    assert.doesNotMatch(JSON.stringify(getAiProviderStatus()), /test-gemini-server-key/);
  } finally {
    Category.find = originalFind;
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalOpenAiApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  }
});

test('Gemini image generation uses server credentials and stores a validated media record', async () => {
  const originalFetch = global.fetch;
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalMediaCreate = Media.create;
  const originalMediaDeleteOne = Media.deleteOne;
  const originalAuditCreate = AuditLog.create;
  const originalStoreMediaFile = mediaStorage.storeMediaFile;
  const originalDeleteMediaFile = mediaStorage.deleteMediaFile;
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let requestUrl = '';
  let requestOptions;
  let mediaInput;
  let auditInput;
  let storedFile;
  let storedMetadata;
  process.env.GEMINI_API_KEY = 'test-gemini-image-key';
  delete process.env.OPENAI_API_KEY;
  global.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({ output_image: { data: png.toString('base64'), mime_type: 'image/png' } })
    };
  };
  Media.create = async (input) => {
    mediaInput = input;
    return { _id: 'media-id', ...input };
  };
  Media.deleteOne = async () => ({ deletedCount: 1 });
  mediaStorage.storeMediaFile = async (file, metadata) => {
    storedFile = file;
    storedMetadata = metadata;
    return 'gridfs-file-id';
  };
  mediaStorage.deleteMediaFile = async () => {};
  AuditLog.create = async (input) => { auditInput = input; return input; };

  try {
    const media = await generateImage({
      title: 'मशरूम शेती',
      content: '<p>भारतीय शेतकऱ्यांसाठी मार्गदर्शक</p>',
      user: { _id: 'admin-id' }
    });
    const requestBody = JSON.parse(requestOptions.body);
    assert.equal(requestUrl, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(requestOptions.headers['x-goog-api-key'], 'test-gemini-image-key');
    assert.equal(requestBody.model, 'gemini-nano-banana-2.1');
    assert.equal(requestBody.store, false);
    assert.equal(media.mimeType, 'image/png');
    assert.equal(mediaInput.url, media.url);
    assert.match(media.url, /^\/api\/media\/[a-f0-9]{24}\/content$/);
    assert.equal(mediaInput.gridFsFileId, 'gridfs-file-id');
    assert.equal(mediaInput.uploadedBy, 'admin-id');
    assert.match(mediaInput.altText, /illustrative image/);
    assert.match(requestBody.input, /landscape 16:9/);
    assert.match(requestBody.input, /@express_udyojak/);
    assert.equal(storedFile.filename, path.basename(storedFile.path));
    assert.equal(storedMetadata.mimeType, 'image/png');
    await assert.rejects(fs.stat(storedFile.path), { code: 'ENOENT' });
    assert.equal(auditInput.actor, 'admin-id');
  } finally {
    if (storedFile?.path) {
      try {
        await fs.unlink(storedFile.path);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    global.fetch = originalFetch;
    Media.create = originalMediaCreate;
    Media.deleteOne = originalMediaDeleteOne;
    mediaStorage.storeMediaFile = originalStoreMediaFile;
    mediaStorage.deleteMediaFile = originalDeleteMediaFile;
    AuditLog.create = originalAuditCreate;
    if (originalGeminiApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiApiKey;
    if (originalOpenAiApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  }
});
