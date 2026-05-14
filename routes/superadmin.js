/**
 * routes/superadmin.js
 * إدارة المنصة: إدارة المتاجر والباقات
 */

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const Tenant   = require('../models/Tenant');
const Plan     = require('../models/Plan');
const { requireSuperAdmin } = require('../middleware/auth');

// ─── تسجيل الدخول ────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  console.log('🔍 GET /superadmin/login - Session:', req.session);
  if (req.session.isSuperAdmin) return res.redirect('/superadmin');
  res.render('superadmin/login', { title: 'إدارة المنصة', error: null, storeName: 'Platform Admin', isAdmin: false, cartCount: 0 });
});

router.post('/login', (req, res) => {
  console.log('🔍 POST /superadmin/login - Body:', req.body);
  const { username, password } = req.body;
  if (username === process.env.SUPER_ADMIN_USER && password === process.env.SUPER_ADMIN_PASS) {
    console.log('✅ كلمات مرور صحيحة - حفظ الجلسة');
    req.session.isSuperAdmin = true;
    return req.session.save((err) => {
      if (err) {
        console.log('❌ خطأ في حفظ الجلسة:', err);
        return res.render('superadmin/login', {
          title: 'إدارة المنصة',
          error: 'تعذر حفظ الجلسة، حاول مرة أخرى',
          storeName: 'Platform Admin',
          isAdmin: false,
          cartCount: 0
        });
      }
      console.log('✅ تم حفظ الجلسة - إعادة توجيه إلى /superadmin');
      return res.redirect('/superadmin');
    });
  }
  console.log('❌ كلمات مرور غير صحيحة');
  res.render('superadmin/login', { title: 'إدارة المنصة', error: 'بيانات غير صحيحة', storeName: 'Platform Admin', isAdmin: false, cartCount: 0 });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/superadmin/login'));
});

// ─── لوحة التحكم الرئيسية ────────────────────────────────────────────────
router.get('/', requireSuperAdmin, async (req, res, next) => {
  try {
    const [tenantCount, activeTenants, plans] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ active: true }),
      Plan.find({ active: true }).sort({ sortOrder: 1 })
    ]);
    const recentTenants = await Tenant.find().sort({ createdAt: -1 }).limit(10).populate('plan');
    res.render('superadmin/dashboard', {
      title: 'لوحة تحكم المنصة', tenantCount, activeTenants, plans, recentTenants,
      storeName: 'Platform Admin', isAdmin: false, cartCount: 0
    });
  } catch (err) { next(err); }
});

// ─── إدارة المتاجر ───────────────────────────────────────────────────────
router.get('/tenants', requireSuperAdmin, async (req, res, next) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 }).populate('plan');
    const plans   = await Plan.find({ active: true }).sort({ sortOrder: 1 });
    res.render('superadmin/tenants', { title: 'المتاجر', tenants, plans, storeName: 'Platform Admin', isAdmin: false, cartCount: 0 });
  } catch (err) { next(err); }
});

// ─── إنشاء متجر جديد ─────────────────────────────────────────────────────
router.post('/tenants', requireSuperAdmin, async (req, res, next) => {
  try {
    const { storeName, subdomain, ownerName, ownerEmail, ownerPhone, adminUsername, adminPassword, planId, trialDays } = req.body;

    const trialEnd = trialDays
      ? new Date(Date.now() + (+trialDays) * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 يوم افتراضي

    await Tenant.create({
      storeName, subdomain: subdomain.toLowerCase(), ownerName, ownerEmail,
      ownerPhone, adminUsername, adminPassword,
      plan: planId || undefined,
      trialEnd,
      planExpiry: trialEnd
    });
    res.redirect('/superadmin/tenants');
  } catch (err) {
    const plans   = await Plan.find({ active: true });
    const tenants = await Tenant.find().populate('plan');
    res.render('superadmin/tenants', { title: 'المتاجر', tenants, plans, error: err.message, storeName: 'Platform Admin', isAdmin: false, cartCount: 0 });
  }
});

// ─── تعديل اشتراك متجر ───────────────────────────────────────────────────
router.put('/tenants/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const { planId, planExpiry, active } = req.body;
    await Tenant.findByIdAndUpdate(req.params.id, {
      plan: planId || undefined,
      planExpiry: planExpiry ? new Date(planExpiry) : undefined,
      active: active === 'true'
    });
    res.redirect('/superadmin/tenants');
  } catch (err) { next(err); }
});

// ─── إدارة الباقات ───────────────────────────────────────────────────────
router.get('/plans', requireSuperAdmin, async (req, res, next) => {
  try {
    const plans = await Plan.find().sort({ sortOrder: 1 });
    res.render('superadmin/plans', { title: 'الباقات', plans, storeName: 'Platform Admin', isAdmin: false, cartCount: 0 });
  } catch (err) { next(err); }
});

router.post('/plans', requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, nameAr, price, productLimit, features, color, popular, sortOrder } = req.body;
    await Plan.create({
      name, nameAr, price: +price,
      productLimit: +productLimit || -1,
      features: features ? features.split('\n').map(f => f.trim()).filter(Boolean) : [],
      color: color || '#6366f1',
      popular: popular === 'on',
      sortOrder: +sortOrder || 0
    });
    res.redirect('/superadmin/plans');
  } catch (err) { next(err); }
});

module.exports = router;
