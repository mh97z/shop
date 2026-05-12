const express  = require('express');
const router   = express.Router();
const Product  = require('../models/Product');
const Category = require('../models/Category');

// الصفحة الرئيسية
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenant._id;
    const [featured, recent, categories] = await Promise.all([
      Product.find({ tenant: tenantId, featured: true, active: true }).limit(8).populate('category').lean(),
      Product.find({ tenant: tenantId, active: true }).sort({ createdAt: -1 }).limit(12).populate('category').lean(),
      Category.find({ tenant: tenantId, active: true }).sort({ order: 1 }).lean()
    ]);
    res.render('index', { title: req.tenant.storeName, featured, recent, categories });
  } catch (err) { next(err); }
});

module.exports = router;
