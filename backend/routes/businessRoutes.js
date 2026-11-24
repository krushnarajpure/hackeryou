const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const controller = require('../controllers/businessController');
const router = express.Router();
const businessImages = upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'images', maxCount: 8 }]);
const validateBusiness = [
  body('businessName').trim().isLength({ min: 2, max: 160 }),
  body('ownerName').trim().isLength({ min: 2, max: 100 }),
  body('category').isMongoId(),
  body('description').trim().isLength({ min: 20, max: 3000 }),
  body('address').trim().notEmpty(),
  body('district').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('mobile').matches(/^[0-9+\- ]{10,15}$/)
];
router.get('/', controller.getBusinesses);
router.get('/search', controller.getBusinesses);
router.get('/slug/:slug', controller.getBusinessBySlug);
router.get('/:id', controller.getBusinessById);
router.post('/', auth, businessImages, upload.validateImages, validateBusiness, controller.createBusiness);
router.put('/:id', auth, businessImages, upload.validateImages, validateBusiness, controller.updateBusiness);
router.delete('/:id', auth, controller.deleteBusiness);
module.exports = router;
