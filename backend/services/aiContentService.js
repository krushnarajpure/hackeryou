const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Media = require('../models/Media');
const writeAuditLog = require('../utils/writeAuditLog');
const mediaStorage = require('../utils/mediaStorage');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ARTICLE_LENGTH = 30000;
const imageDirectory = path.join(__dirname, '..', 'uploads');

const articleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    slug: { type: 'string' },
    subtitle: { type: 'string' },
    excerpt: { type: 'string' },
    contentMarkdown: { type: 'string' },
    seoTitle: { type: 'string' },
    seoDescription: { type: 'string' },
    category: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    faqs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer']
      }
    },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, url: { type: 'string' } },
        required: ['title', 'url']
      }
    }
  },
  required: ['title', 'slug', 'subtitle', 'excerpt', 'contentMarkdown', 'seoTitle', 'seoDescription', 'category', 'tags', 'faqs', 'sources']
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const inlineMarkdown = (value) => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>');

function markdownToHtml(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listType = '';

  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = '';
  };
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const nextLine = lines[index + 1]?.trim() || '';
    const isTable = line.includes('|') && /^\|?\s*:?-{3,}/.test(nextLine);

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    if (isTable) {
      flushParagraph();
      closeList();
      const readCells = (row) => row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
      const headers = readCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().includes('|')) {
        rows.push(readCells(lines[index].trim()));
        index += 1;
      }
      index -= 1;
      html.push(`<table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, cellIndex) => `<td>${inlineMarkdown(row[cellIndex] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length + 1, 6);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = /^([-*]|\d+\.)\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph();
      const type = /^\d/.test(listItem[1]) ? 'ol' : 'ul';
      if (listType !== type) {
        closeList();
        html.push(`<${type}>`);
        listType = type;
      }
      html.push(`<li>${inlineMarkdown(listItem[2])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return html.join('\n');
}

function validateSource(source) {
  try {
    const url = new URL(source.url);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return { title: String(source.title || url.hostname).slice(0, 200), url: url.toString() };
  } catch {
    return null;
  }
}

function buildArticleHtml(result) {
  const body = markdownToHtml(result.contentMarkdown);
  const faqs = (result.faqs || []).slice(0, 12);
  const faqHtml = faqs.length
    ? `<h2>वारंवार विचारले जाणारे प्रश्न</h2>${faqs.map((faq) => `<h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p>`).join('')}`
    : '';
  const sources = (result.sources || []).map(validateSource).filter(Boolean).slice(0, 10);
  const sourceHtml = sources.length
    ? `<h2>संदर्भ</h2><ul>${sources.map((source) => `<li><a href="${escapeHtml(source.url)}" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul>`
    : '';
  return `${body}${faqHtml}${sourceHtml}`;
}

async function openAiRequest(endpoint, payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw Object.assign(new Error('AI सुविधा सुरू करण्यासाठी backend मध्ये OPENAI_API_KEY configure करा.'), { statusCode: 503 });

  let response;
  try {
    response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000)
    });
  } catch (error) {
    throw Object.assign(new Error(`AI सेवा उपलब्ध नाही: ${error.message}`), { statusCode: 502 });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `AI सेवा विनंती अयशस्वी झाली (${response.status}).`;
    throw Object.assign(new Error(message), { statusCode: response.status === 429 ? 429 : 502 });
  }
  return data;
}

async function geminiRequest(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error('AI सुविधा सुरू करण्यासाठी backend मध्ये GEMINI_API_KEY configure करा.'), { statusCode: 503 });

  let response;
  try {
    response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Api-Revision': '2026-05-20',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000)
    });
  } catch (error) {
    throw Object.assign(new Error(`Gemini सेवा उपलब्ध नाही: ${error.message}`), { statusCode: 502 });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `Gemini विनंती अयशस्वी झाली (${response.status}).`;
    throw Object.assign(new Error(message), { statusCode: response.status === 429 ? 429 : 502 });
  }
  return data;
}

function responseText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const interactionContent = (response.steps || [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content || []);
  const interactionText = interactionContent.find((item) => item.type === 'text')?.text;
  if (typeof interactionText === 'string') return interactionText;
  const content = (response.output || []).flatMap((item) => item.content || []);
  return content.find((item) => item.type === 'output_text')?.text || '';
}

function getGeminiCitations(response) {
  return (response.steps || [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content || [])
    .flatMap((item) => item.annotations || [])
    .filter((annotation) => annotation.type === 'url_citation' && annotation.url)
    .map((annotation) => validateSource({ title: annotation.title || annotation.url, url: annotation.url }))
    .filter(Boolean);
}

function getAiProviderStatus() {
  const provider = process.env.GEMINI_API_KEY
    ? 'Gemini'
    : process.env.OPENAI_API_KEY
      ? 'OpenAI'
      : null;
  return {
    provider,
    configured: Boolean(provider),
    imageConfigured: Boolean(provider),
    model: provider === 'Gemini'
      ? process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite'
      : provider === 'OpenAI'
        ? process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini'
        : null
  };
}

async function generateArticle({ mode, prompt, content }) {
  if (!['create', 'format'].includes(mode)) throw Object.assign(new Error('लेख तयार करण्याचा प्रकार अवैध आहे.'), { statusCode: 400 });
  if (mode === 'create' && (!prompt || prompt.length > 500)) {
    throw Object.assign(new Error('विषय किंवा सूचना 1 ते 500 अक्षरांमध्ये द्या.'), { statusCode: 400 });
  }
  if (mode === 'format' && (!content || content.length > MAX_ARTICLE_LENGTH)) {
    throw Object.assign(new Error(`लेखाचा मजकूर 1 ते ${MAX_ARTICLE_LENGTH} अक्षरांमध्ये द्या.`), { statusCode: 400 });
  }

  const categories = await Category.find({ isActive: true }).select('name slug').limit(100).lean();
  const categoryNames = categories.map((category) => category.name);
  const system = mode === 'create'
    ? 'You are the editorial research assistant for Express Udyojak, a Marathi-first Indian business publication. Research the requested topic using the web search tool. Prefer official Indian government, university, and recognized industry sources. Do not invent current statistics, schemes, eligibility rules, prices, or citations. Write original, useful article content in the language requested by the user. Return a complete article and only verifiable source URLs actually consulted. Use clear Markdown headings, lists, and tables where helpful. Create a concise excerpt and SEO metadata. Choose exactly one category from the supplied list, or General if none fits. Keep the slug lowercase ASCII and hyphen-separated. Include relevant FAQs only when they can be answered reliably.'
    : 'You are a careful editor for Express Udyojak. Format the supplied article into readable Markdown headings, paragraphs, lists, and tables. Preserve its meaning, information, claims, figures, and language. Do not add, remove, summarize, or factually rewrite content. Extract an existing title where possible; otherwise make only a short descriptive title based on the supplied text. Generate concise SEO metadata without changing article facts. Do not research or introduce new facts. Return no FAQs and no sources unless they already appear in the supplied text.';
  const user = mode === 'create'
    ? `Admin request: ${prompt}\nAvailable categories: ${categoryNames.join(', ') || 'General'}`
    : `Format this existing article without substantive rewriting:\n\n${content}`;

  const response = process.env.GEMINI_API_KEY
    ? await geminiRequest({
      model: process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite',
      system_instruction: system,
      input: user,
      store: false,
      ...(mode === 'create' ? { tools: [{ type: 'google_search' }] } : {}),
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: articleSchema
      }
    })
    : await openAiRequest('responses', {
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini',
      ...(mode === 'create' ? { tools: [{ type: 'web_search_preview' }] } : {}),
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        { role: 'user', content: [{ type: 'input_text', text: user }] }
      ],
      text: { format: { type: 'json_schema', name: 'express_udyojak_article', strict: true, schema: articleSchema } },
      max_output_tokens: 8000
    });

  let article;
  try {
    article = JSON.parse(responseText(response));
  } catch {
    throw Object.assign(new Error('AI कडून योग्य लेख प्रतिसाद मिळाला नाही. पुन्हा प्रयत्न करा.'), { statusCode: 502 });
  }
  if (!article.title?.trim() || !article.contentMarkdown?.trim()) {
    throw Object.assign(new Error('AI प्रतिसादात लेखाचे शीर्षक किंवा मजकूर रिकामा आहे.'), { statusCode: 502 });
  }

  const category = categoryNames.find((name) => name === article.category) || 'General';
  const sources = [...(article.sources || []), ...getGeminiCitations(response)]
    .map(validateSource)
    .filter(Boolean)
    .filter((source, index, list) => list.findIndex((item) => item.url === source.url) === index)
    .slice(0, 10);
  return {
    article: {
      title: article.title.slice(0, 300),
      slug: article.slug.slice(0, 180),
      subtitle: article.subtitle.slice(0, 500),
      excerpt: article.excerpt.slice(0, 1000),
      content: buildArticleHtml(article),
      seoTitle: article.seoTitle.slice(0, 300),
      seoDescription: article.seoDescription.slice(0, 1000),
      category,
      tags: article.tags.slice(0, 20).map((tag) => tag.slice(0, 80))
    },
    faqs: (article.faqs || []).slice(0, 12),
    sources
  };
}

async function generateImage({ title, content, user }) {
  const cleanTitle = String(title || '').trim().slice(0, 300);
  const cleanContent = String(content || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 3000);
  if (!cleanTitle || !cleanContent) {
    throw Object.assign(new Error('लेखाचे शीर्षक आणि मजकूर आवश्यक आहे.'), { statusCode: 400 });
  }

  const prompt = `Create an original, photorealistic, landscape 16:9 editorial featured image for an Indian business article. Topic: ${cleanTitle}. Context: ${cleanContent}. Show an authentic Indian business, farming, machinery, or industry setting as appropriate. For a named seller's product, depict only an illustrative generic product and do not imply it is that seller's actual machine. Use natural industrial light, professional product photography, and no fabricated brand or company logo. Add a small, tasteful, legible lower-right watermark reading "EXPRESS_UDYOJAK" with an Instagram camera icon and "@express_udyojak". Avoid other text and incorrect specifications.`;
  let encoded;
  let mimeType = 'image/png';
  if (process.env.GEMINI_API_KEY) {
    const result = await geminiRequest({
      model: process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1',
      input: prompt,
      store: false
    });
    const image = result.output_image || (result.steps || [])
      .filter((step) => step.type === 'model_output')
      .flatMap((step) => step.content || [])
      .find((item) => item.type === 'image');
    encoded = image?.data;
    mimeType = image?.mime_type || '';
  } else {
    const result = await openAiRequest('images/generations', {
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt,
      size: '1536x1024',
      quality: 'medium',
      output_format: 'png',
      n: 1
    });
    encoded = result.data?.[0]?.b64_json;
  }
  if (!encoded || encoded.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3)) {
    throw Object.assign(new Error('AI प्रतिमा रिकामी आहे किंवा media library च्या 5 MB मर्यादेपेक्षा मोठी आहे.'), { statusCode: 502 });
  }

  const bytes = Buffer.from(encoded, 'base64');
  const imageFormats = {
    'image/png': {
      extension: 'png',
      matches: () => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    },
    'image/jpeg': {
      extension: 'jpg',
      matches: () => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    },
    'image/webp': {
      extension: 'webp',
      matches: () => bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    }
  };
  const imageFormat = imageFormats[mimeType];
  if (bytes.length > MAX_IMAGE_BYTES || !imageFormat?.matches()) {
    throw Object.assign(new Error('AI प्रतिमेचा प्रकार किंवा आकार अवैध आहे.'), { statusCode: 502 });
  }

  await fs.promises.mkdir(imageDirectory, { recursive: true });
  const filename = `ai-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${imageFormat.extension}`;
  const filePath = path.join(imageDirectory, filename);
  await fs.promises.writeFile(filePath, bytes, { flag: 'wx' });
  const mediaId = new mongoose.Types.ObjectId();
  let gridFsFileId;
  let media;
  try {
    gridFsFileId = await mediaStorage.storeMediaFile({ path: filePath, filename }, {
      mimeType,
      uploadedBy: String(user._id)
    });
    media = await Media.create({
      _id: mediaId,
      title: `${cleanTitle} - AI featured image`.slice(0, 200),
      altText: `AI-generated illustrative image for ${cleanTitle}; not the seller's actual product photograph`.slice(0, 300),
      caption: 'AI-generated illustrative image; not a photograph of the named seller’s specific machine.',
      filename,
      originalName: filename,
      gridFsFileId,
      mediaType: 'image',
      uploadedBy: user._id,
      url: `/api/media/${mediaId}/content`,
      mimeType,
      size: bytes.length
    });
    await fs.promises.unlink(filePath);
  } catch (error) {
    const cleanupErrors = [];
    if (media) {
      try {
        await Media.deleteOne({ _id: media._id });
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (gridFsFileId) {
      try {
        await mediaStorage.deleteMediaFile(gridFsFileId);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    try {
      await fs.promises.unlink(filePath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') cleanupErrors.push(cleanupError);
    }
    if (cleanupErrors.length) console.error('AI media cleanup failed:', cleanupErrors.map((item) => item.message).join('; '));
    throw error;
  }
  await writeAuditLog({ user }, 'media.ai_generate', 'media', media._id, `AI image generated for "${cleanTitle}"`);
  return media;
}

module.exports = { generateArticle, generateImage, getAiProviderStatus, markdownToHtml };
