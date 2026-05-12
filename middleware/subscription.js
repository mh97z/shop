/**
 * middleware/subscription.js
 * يتحقق من حدود الباقة قبل تنفيذ عمليات المتجر
 */

const Product = require('../models/Product');

// حدود الباقات الافتراضية
const PLAN_LIMITS = {
  Basic:   { productLimit: 20,   bannerCount: 1,  customDomain: false, analytics: false },
  Pro:     { productLimit: 100,  bannerCount: 3,  customDomain: true,  analytics: false },
  Premium: { productLimit: -1,   bannerCount: 10, customDomain: true,  analytics: true  }
};

/**
 * يتحقق من حد المنتجات قبل الإضافة
 */
async function checkProductLimit(req, res, next) {
  try {
    const tenant = req.tenant;
    if (!tenant) return next();

    const plan  = tenant.plan;
    const limit = plan?.productLimit ?? PLAN_LIMITS[plan?.name]?.productLimit ?? 20;

    if (limit === -1) return next(); // غير محدود (Premium)

    const count = await Product.countDocuments({ tenant: tenant._id, active: true });
    if (count >= limit) {
      return res.status(403).json({
        success: false,
        message: `وصلت إلى الحد الأقصى للباقة (${limit} منتج). يرجى الترقية إلى باقة أعلى.`,
        upgrade: true
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * يتحقق من انتهاء صلاحية الاشتراك
 */
function checkSubscriptionActive(req, res, next) {
  const tenant = req.tenant;
  if (!tenant) return next();

  // إذا لم يكن هناك تاريخ انتهاء، استمر
  if (!tenant.planExpiry) return next();

  if (new Date() > new Date(tenant.planExpiry)) {
    return res.status(403).render('error', {
      title: 'انتهى الاشتراك',
      error: 'انتهت صلاحية اشتراكك. يرجى تجديد الاشتراك من لوحة التحكم.',
      storeName: tenant.storeName,
      isAdmin: req.session?.isAdmin || false,
      cartCount: 0
    });
  }
  next();
}

module.exports = { checkProductLimit, checkSubscriptionActive };
