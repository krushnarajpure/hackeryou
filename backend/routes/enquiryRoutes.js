const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const controller = require('../controllers/enquiryController');
const router = express.Router();
router.post('/', [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('mobile').trim().matches(/^[0-9+\- ]{10,15}$/),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('message').trim().isLength({ min: 10, max: 2000 })
], controller.submitEnquiry);
router.get('/', auth, admin, controller.getEnquiries);
router.put('/:id/status', auth, admin, [body('status').isIn(['new', 'contacted', 'closed'])], controller.updateEnquiryStatus);
router.delete('/:id', auth, admin, controller.deleteEnquiry);
module.exports = router;
