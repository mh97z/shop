const express  = require('express');
const router   = express.Router();
const Product  = require('../models/Product');
const Category = require('../models/Category');

// بحث AJAX عن المنتجات
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    const tenantId = req.tenant?._id;

    const products = await Product.find({
      tenant: tenantId, active: true,
      $or: [
        { name:  { $regex: q, $options: 'i' } },
        { tags:  { $regex: q, $options: 'i' } }
      ]
    }).limit(8).select('name slug basePrice images').lean();

    res.json(products);
  } catch (err) { res.status(500).json([]); }
});

// جلب الفئات مع صورها
router.get('/categories', async (req, res) => {
  try {
    const tenantId = req.tenant?._id;
    const cats = await Category.find({ tenant: tenantId, active: true }).sort({ order: 1 }).lean();
    res.json(cats);
  } catch (err) { res.status(500).json([]); }
});

module.exports = router;
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);

    const products = await Product.find({
      active: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } }
      ]
    }).limit(8).select('name slug basePrice images');

    res.json(products);
  } catch (err) {
    res.status(500).json([]);
  }
});

// جلب الفئات
router.get('/categories', async (req, res) => {
  try {
    const cats = await Category.find({ active: true }).sort({ order: 1 });
    res.json(cats);
  } catch (err) {
    res.status(500).json([]);
  }
});

module.exports = router;
