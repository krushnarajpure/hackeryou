const INDEXES = [
  ['Book', 'cms_book_slug_unique'],
  ['Book', 'cms_book_sku_unique'],
  ['BookOrder', 'cms_order_number_unique'],
  ['BookOrder', 'cms_razorpay_order_unique'],
  ['BookOrder', 'cms_orders_by_user_created'],
  ['BookOrder', 'cms_order_reservation_expiry'],
  ['BookOrder', 'cms_paid_orders_by_verified_at'],
  ['AuditLog', 'cms_audit_created_at'],
  ['AuditLog', 'cms_audit_entity_created_at'],
  ['Article', 'cms_scheduled_article_publish']
];

async function main() {
  if (!process.argv.includes('--confirm-backup')) {
    throw new Error('Refusing to modify MongoDB: export a database backup, then pass --confirm-backup explicitly.');
  }
  require('dotenv').config();
  const connectDB = require('../config/db');
  const mongoose = require('mongoose');
  const models = {
    Book: require('../models/Book'),
    BookOrder: require('../models/BookOrder'),
    AuditLog: require('../models/AuditLog'),
    Article: require('../models/Article')
  };
  await connectDB();
  try {
    for (const [modelName, name] of INDEXES) {
      const currentIndexes = await models[modelName].collection.indexes();
      if (currentIndexes.some((index) => index.name === name)) {
        await models[modelName].collection.dropIndex(name);
        console.log(`Dropped ${modelName}.${name}`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`CMS index rollback failed: ${error.message}`);
  process.exitCode = 1;
});
