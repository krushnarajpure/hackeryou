const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/authController');
const router = express.Router();
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('mobile').optional({ checkFalsy: true }).matches(/^[0-9+\- ]{10,15}$/),
  body('password').isLength({ min: 8 }).matches(/[A-Za-z]/).matches(/[0-9]/)
], controller.register);
router.post('/login', [
  body('password').notEmpty(),
  body('identifier').optional().isString().trim().if((value) => value.includes('@')).isEmail().normalizeEmail(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('mobile').optional({ checkFalsy: true }).trim().matches(/^[0-9+\- ]{10,15}$/)
], controller.login);
router.post('/logout', auth, controller.logout);
router.post('/forgot-password', [body('email').optional().isEmail(), body('mobile').optional().matches(/^[0-9+\- ]{10,15}$/)], controller.forgotPassword);
router.post('/reset-password/:token', [body('password').isLength({ min: 8 }).matches(/[A-Za-z]/).matches(/[0-9]/)], controller.resetPassword);
module.exports = router;
