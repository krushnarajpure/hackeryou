const INDEXES = [
  ['Book', 'cms_book_slug_unique', { slug: 1 }, { unique: true }],
  ['Book', 'cms_book_sku_unique', { sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: 'string', $gt: '' } } }],
  ['BookOrder', 'cms_order_number_unique', { orderNumber: 1 }, { unique: true }],
  ['BookOrder', 'cms_razorpay_order_unique', { razorpayOrderId: 1 }, { unique: true, partialFilterExpression: { razorpayOrderId: { $type: 'string', $gt: '' } } }],
  ['BookOrder', 'cms_orders_by_user_created', { user: 1, createdAt: -1 }, {}],
  ['BookOrder', 'cms_order_reservation_expiry', { paymentStatus: 1, stockReserved: 1, reservationExpiresAt: 1 }, {}],
  ['BookOrder', 'cms_paid_orders_by_verified_at', { paymentStatus: 1, verifiedAt: 1 }, {}],
  ['AuditLog', 'cms_audit_created_at', { createdAt: -1 }, {}],
  ['AuditLog', 'cms_audit_entity_created_at', { entityType: 1, createdAt: -1 }, {}],
  ['Article', 'cms_scheduled_article_publish', { isPublished: 1, archivedAt: 1, scheduledAt: 1 }, {}]
];

const confirmBackup = () => {
  if (!process.argv.includes('--confirm-backup')) {
    throw new Error('Refusing to modify MongoDB: export a database backup, then pass --confirm-backup explicitly.');
  }
};

const assertUniqueValues = async (Model, field, filter) => {
  const duplicates = await Model.aggregate([
    { $match: filter },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 }
  ]);
  if (duplicates.length) throw new Error(`Cannot create the ${field} index: duplicate values exist in ${Model.modelName}.`);
};

async function main() {
  confirmBackup();
  require('dotenv').config();
  const connectDB = require('../config/db');
  const mongoose = require('mongoose');
  const Book = require('../models/Book');
  const BookOrder = require('../models/BookOrder');
  const AuditLog = require('../models/AuditLog');
  const Article = require('../models/Article');
  const models = { Book, BookOrder, AuditLog, Article };
  await connectDB();
  try {
    await assertUniqueValues(Book, 'slug', { slug: { $type: 'string', $gt: '' } });
    await assertUniqueValues(Book, 'sku', { sku: { $type: 'string', $gt: '' } });
    await assertUniqueValues(BookOrder, 'orderNumber', { orderNumber: { $type: 'string', $gt: '' } });
    await assertUniqueValues(BookOrder, 'razorpayOrderId', { razorpayOrderId: { $type: 'string', $gt: '' } });
    for (const [modelName, name, keys, options] of INDEXES) {
      await models[modelName].collection.createIndex(keys, { ...options, name });
      console.log(`Created ${modelName}.${name}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`CMS index migration failed: ${error.message}`);
  process.exitCode = 1;
});
