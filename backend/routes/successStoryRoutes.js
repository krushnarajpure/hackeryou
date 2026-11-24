const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const controller = require('../controllers/successStoryController');

const router = express.Router();
const submissionValidation = [
  body('title').trim().isLength({ min: 5, max: 180 }),
  body('entrepreneurName').trim().isLength({ min: 2, max: 100 }),
  body('businessName').trim().isLength({ min: 2, max: 160 }),
  body('city').trim().isLength({ min: 2, max: 100 }),
  body('summary').trim().isLength({ min: 20, max: 500 }),
  body('story').trim().isLength({ min: 30, max: 12000 }),
  body('image').optional({ checkFalsy: true }).isURL({ protocols: ['https'], require_protocol: true })
];

router.get('/admin', auth, admin, controller.getAllStories);
router.get('/', controller.getStories);
router.get('/:id', controller.getStory);
router.post('/submit', submissionValidation, controller.submitStory);
router.post('/', auth, admin, controller.createStory);
router.put('/:id', auth, admin, controller.updateStory);
router.patch('/:id/publish', auth, admin, controller.publishStory);
router.delete('/:id', auth, admin, controller.deleteStory);

module.exports = router;
