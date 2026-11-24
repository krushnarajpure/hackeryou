const express = require('express');
const auth = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const upload = require('../middleware/uploadMiddleware');
const controller = require('../controllers/storeController');

const router = express.Router();

router.get('/books', controller.listBooks);
router.get('/books/:slug', controller.getBook);
router.get('/checkout-config', controller.checkoutConfig);
router.post('/webhook', controller.webhook);

router.use(auth);
router.post('/checkout', controller.createOrder);
router.post('/orders/:id/verify', controller.verifyOrderPayment);
router.get('/admin/books', requirePermission('store:read'), controller.listAdminBooks);
router.post('/admin/books', requirePermission('store:write'), upload.single('cover'), upload.validateImages, controller.createBook);
router.put('/admin/books/:id', requirePermission('store:write'), upload.single('cover'), upload.validateImages, controller.updateBook);
router.patch('/admin/books/:id/status', requirePermission('store:write'), controller.setBookStatus);
router.get('/admin/orders', requirePermission('orders:read'), controller.listOrders);
router.patch('/admin/orders/:id/fulfillment', requirePermission('orders:write'), controller.updateFulfillment);

module.exports = router;
