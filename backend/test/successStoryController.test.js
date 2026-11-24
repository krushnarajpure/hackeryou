const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');
const slugify = require('../utils/slugify');

let createdStory;
const SuccessStory = {
  exists: async () => false,
  create: async (story) => {
    createdStory = { _id: 'story-1', ...story };
    return createdStory;
  }
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith('successStoryController.js') && request === '../models/SuccessStory') {
    return SuccessStory;
  }
  return originalLoad.call(this, request, parent, isMain);
};
const controller = require('../controllers/successStoryController');
Module._load = originalLoad;

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

test('slugify preserves Marathi characters and separates words', () => {
  assert.equal(slugify('साताऱ्यातील यशोगाथा'), 'साताऱ्यातील-यशोगाथा');
  assert.equal(slugify('Small Business Story'), 'small-business-story');
});

test('public success-story submissions are stored pending review', async () => {
  const response = makeResponse();
  await controller.submitStory({
    body: {
      title: 'साताऱ्यातील यशोगाथा',
      entrepreneurName: 'उद्योजक',
      businessName: 'स्थानिक उद्योग',
      city: 'सातारा',
      summary: 'मेहनतीतून उभा राहिलेला स्थानिक व्यवसाय.',
      story: 'या कथेमध्ये व्यवसायाची सुरुवात, आव्हाने आणि पुढील वाटचाल सांगितली आहे.'
    }
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(createdStory.slug, 'साताऱ्यातील-यशोगाथा');
  assert.equal(createdStory.isPublished, false);
  assert.equal(response.body.storyId, 'story-1');
});
