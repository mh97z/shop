const express  = require('express');
const router   = express.Router();
const Product  = require('../models/Product');
const Category = require('../models/Category');

// صفحة جميع المنتجات
router.get('/', async (req, res, next) => {
  try {
    const tenantId        = req.tenant._id;
    const { cat, q, page = 1 } = req.query;
    const limit = 16;
    const skip  = (page - 1) * limit;

    let filter = { tenant: tenantId, active: true };
    if (cat) filter.category = cat;
    if (q)   filter.$text = { $search: q };

    const [products, total, categories] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('category').lean(),
      Product.countDocuments(filter),
      Category.find({ tenant: tenantId, active: true }).sort({ order: 1 }).lean()
    ]);

    res.render('products', {
      title: 'المنتجات', products, categories,
      currentCat: cat || '', searchQuery: q || '',
      currentPage: +page, totalPages: Math.ceil(total / limit), total
    });
  } catch (err) { next(err); }
});

// صفحة منتج مفرد
router.get('/:slug', async (req, res, next) => {
  try {
    const tenantId = req.tenant._id;
    const product  = await Product.findOne({ tenant: tenantId, slug: req.params.slug, active: true }).populate('category').lean();
    if (!product) return res.status(404).render('404', { title: 'المنتج غير موجود' });

    const similar = await Product.find({
      tenant: tenantId, category: product.category?._id,
      _id: { $ne: product._id }, active: true
    }).limit(6).lean();

    res.render('product', { title: product.name, product, similar });
  } catch (err) { next(err); }
});

module.exports = router;

// صفحة منتج مفرد
router.get('/:slug', async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, active: true }).populate('category');
    if (!product) return res.status(404).render('404', { title: 'المنتج غير موجود' });

    // منتجات مشابهة
    const similar = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      active: true
    }).limit(6);

    res.render('product', { title: product.name, product, similar });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
