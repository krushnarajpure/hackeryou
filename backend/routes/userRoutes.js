const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/userController');
const router = express.Router();
router.use(auth);
router.get('/profile', controller.getProfile);
router.put('/profile', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('mobile').optional({ checkFalsy: true }).matches(/^[0-9+\- ]{10,15}$/)
], controller.updateProfile);
router.put('/change-password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/[A-Za-z]/).matches(/[0-9]/)
], controller.changePassword);
module.exports = router;
