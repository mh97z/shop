const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp      = require('sharp');
const requireAdmin   = require('../middleware/auth');
const { checkProductLimit } = require('../middleware/subscription');
const Product    = require('../models/Product');
const Category   = require('../models/Category');
const Order      = require('../models/Order');
const Tenant     = require('../models/Tenant');
const Plan       = require('../models/Plan');

// ─── إعداد رفع الصور (في الذاكرة ثم نعالجها بـ Sharp) ───────────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('نوع الملف غير مسموح به'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── معالجة الصورة بـ Sharp (تغيير الأبعاد فقط، جودة 100%) ──────────────
async function processImage(buffer, filename) {
  const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const outName = uuidv4() + '.webp';
  const outPath = path.join(uploadDir, outName);

  // تغيير الأبعاد فقط: 800x800 مع الحفاظ على نسبة الأبعاد، جودة 100%
  await sharp(buffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ lossless: true })  // lossless = جودة 100% بدون فقدان
    .toFile(outPath);

  return '/uploads/' + outName;
}

// ─── تسجيل الدخول ────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { title: 'تسجيل الدخول', error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const tenant = req.tenant;
  if (username === tenant.adminUsername && password === tenant.adminPassword) {
    req.session.isAdmin   = true;
    req.session.tenantId  = tenant._id.toString();
    return res.redirect('/admin');
  }
  res.render('admin/login', { title: 'تسجيل الدخول', error: 'اسم المستخدم أو كلمة المرور خاطئة' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ─── لوحة التحكم ─────────────────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const tenantId = req.tenant._id;
    const [prodCount, orderCount, pendingCount, recentOrders] = await Promise.all([
      Product.countDocuments({ tenant: tenantId }),
      Order.countDocuments({ tenant: tenantId }),
      Order.countDocuments({ tenant: tenantId, status: 'pending' }),
      Order.find({ tenant: tenantId }).sort({ createdAt: -1 }).limit(10).lean()
    ]);
    res.render('admin/dashboard', { title: 'لوحة التحكم', prodCount, orderCount, pendingCount, recentOrders });
  } catch (err) { next(err); }
});

// ─── المنتجات ────────────────────────────────────────────────────────────
router.get('/products', requireAdmin, async (req, res, next) => {
  try {
    const tenantId   = req.tenant._id;
    const products   = await Product.find({ tenant: tenantId }).sort({ createdAt: -1 }).populate('category').lean();
    const categories = await Category.find({ tenant: tenantId }).sort({ order: 1 }).lean();
    res.render('admin/products', { title: 'المنتجات', products, categories });
  } catch (err) { next(err); }
});

router.get('/products/new', requireAdmin, async (req, res, next) => {
  try {
    const categories = await Category.find({ tenant: req.tenant._id, active: true }).sort({ order: 1 }).lean();
    res.render('admin/product-form', { title: 'منتج جديد', product: null, categories, error: null });
  } catch (err) { next(err); }
});

router.post('/products', requireAdmin, checkProductLimit, upload.array('images', 6), async (req, res, next) => {
  try {
    const tenantId = req.tenant._id;
    const { name, description, basePrice, category, tags, featured, active } = req.body;

    const sizeLabels = [].concat(req.body['sizes[label]'] || []);
    const sizePrices = [].concat(req.body['sizes[price]'] || []);
    const sizes = sizeLabels.map((label, i) => ({ label, price: +sizePrices[i] || +basePrice }))
                            .filter(s => s.label.trim());

    // معالجة الصور بـ Sharp
    const images = [];
    for (const file of (req.files || [])) {
      const imgPath = await processImage(file.buffer, file.originalname);
      images.push(imgPath);
    }

    const slug = slugify(name);
    await Product.create({
      tenant: tenantId, name, description, basePrice: +basePrice,
      slug, sizes, images,
      category: category || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      featured: featured === 'on',
      active:   active   !== 'off'
    });
    res.redirect('/admin/products');
  } catch (err) {
    const categories = await Category.find({ tenant: req.tenant._id });
    res.render('admin/product-form', { title: 'منتج جديد', product: null, categories, error: err.message });
  }
});

router.get('/products/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const product    = await Product.findOne({ _id: req.params.id, tenant: req.tenant._id }).lean();
    const categories = await Category.find({ tenant: req.tenant._id, active: true }).sort({ order: 1 }).lean();
    if (!product) return res.redirect('/admin/products');
    res.render('admin/product-form', { title: 'تعديل المنتج', product, categories, error: null });
  } catch (err) { next(err); }
});

router.put('/products/:id', requireAdmin, upload.array('images', 6), async (req, res, next) => {
  try {
    const tenantId = req.tenant._id;
    const { name, description, basePrice, category, tags, featured, active, existingImages } = req.body;

    const sizeLabels = [].concat(req.body['sizes[label]'] || []);
    const sizePrices = [].concat(req.body['sizes[price]'] || []);
    const sizes = sizeLabels.map((label, i) => ({ label, price: +sizePrices[i] || +basePrice }))
                            .filter(s => s.label.trim());

    // معالجة الصور الجديدة بـ Sharp
    const newImages = [];
    for (const file of (req.files || [])) {
      const imgPath = await processImage(file.buffer, file.originalname);
      newImages.push(imgPath);
    }

    const oldImages = existingImages ? [].concat(existingImages) : [];
    const images    = [...oldImages, ...newImages];

    await Product.findOneAndUpdate({ _id: req.params.id, tenant: tenantId }, {
      name, description, basePrice: +basePrice,
      slug: slugify(name), sizes, images,
      category: category || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      featured: featured === 'on',
      active:   active   !== 'off'
    });
    res.redirect('/admin/products');
  } catch (err) { next(err); }
});

router.delete('/products/:id', requireAdmin, async (req, res, next) => {
  try {
    await Product.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id });
    res.redirect('/admin/products');
  } catch (err) { next(err); }
});

// ─── الفئات ──────────────────────────────────────────────────────────────
router.get('/categories', requireAdmin, async (req, res, next) => {
  try {
    const categories = await Category.find({ tenant: req.tenant._id }).sort({ order: 1 }).lean();
    res.render('admin/categories', { title: 'الفئات', categories, error: null });
  } catch (err) { next(err); }
});

router.post('/categories', requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    const { name, order } = req.body;
    let image = '';
    if (req.file) {
      image = await processImage(req.file.buffer, req.file.originalname);
    }
    await Category.create({ tenant: req.tenant._id, name, slug: slugify(name), order: +order || 0, image });
    res.redirect('/admin/categories');
  } catch (err) {
    const categories = await Category.find({ tenant: req.tenant._id }).sort({ order: 1 }).lean();
    res.render('admin/categories', { title: 'الفئات', categories, error: err.message });
  }
});

router.delete('/categories/:id', requireAdmin, async (req, res, next) => {
  try {
    await Category.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id });
    res.redirect('/admin/categories');
  } catch (err) { next(err); }
});

// ─── الطلبات ─────────────────────────────────────────────────────────────
router.get('/orders', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { tenant: req.tenant._id };
    if (status) filter.status = status;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    res.render('admin/orders', { title: 'الطلبات', orders, currentStatus: status || '' });
  } catch (err) { next(err); }
});

router.get('/orders/:id', requireAdmin, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, tenant: req.tenant._id }).populate('items.product').lean();
    if (!order) return res.redirect('/admin/orders');
    res.render('admin/order-detail', { title: 'تفاصيل الطلب', order });
  } catch (err) { next(err); }
});

router.put('/orders/:id/status', requireAdmin, async (req, res, next) => {
  try {
    await Order.findOneAndUpdate({ _id: req.params.id, tenant: req.tenant._id }, { status: req.body.status });
    res.redirect('/admin/orders/' + req.params.id);
  } catch (err) { next(err); }
});

// ─── إعدادات الاشتراك ────────────────────────────────────────────────────
router.get('/subscription', requireAdmin, async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenant._id).populate('plan').lean();
    const plans  = await Plan.find({ active: true }).sort({ sortOrder: 1 }).lean();
    const productCount = await Product.countDocuments({ tenant: req.tenant._id });
    res.render('admin/subscription', { title: 'الاشتراك', tenant, plans, productCount });
  } catch (err) { next(err); }
});

// ─── إعدادات المتجر ──────────────────────────────────────────────────────
router.get('/settings', requireAdmin, async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenant._id).lean();
    res.render('admin/settings', { title: 'الإعدادات', tenant });
  } catch (err) { next(err); }
});

router.put('/settings', requireAdmin, upload.single('logo'), async (req, res, next) => {
  try {
    const { storeName, whatsapp, instagram, tiktok, telegram, facebook, primaryColor, currency } = req.body;
    const update = { storeName, whatsapp, instagram, tiktok, telegram, facebook, primaryColor: primaryColor || '#EC4899', currency: currency || 'د.ع' };

    if (req.file) {
      update.logo = await processImage(req.file.buffer, req.file.originalname);
    }

    await Tenant.findByIdAndUpdate(req.tenant._id, update);
    res.redirect('/admin/settings');
  } catch (err) { next(err); }
});

// ─── helper ──────────────────────────────────────────────────────────────
function slugify(text) {
  return text.trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FF\w-]/g, '')
    .toLowerCase()
    + '-' + Date.now();
}

module.exports = router;
