/**
 * middleware/tenant.js
 * يحل هوية المتجر (Tenant) من اسم المضيف (hostname)
 * - store1.platform.com  → يبحث عن subdomain = "store1"
 * - store1.localhost      → يبحث عن subdomain = "store1"
 * - customdomain.com      → يبحث عن domain = "customdomain.com"
 * - في بيئة التطوير يمكن تجاوز ذلك بـ ?__tenant=subdomain
 */

const Tenant = require('../models/Tenant');

function isIpAddress(host) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host === 'localhost';
}

module.exports = async function resolveTenant(req, res, next) {
  try {
    const host   = req.hostname.toLowerCase();
    const parts  = host.split('.');
    let tenant   = null;

    // ─── تجاوز في بيئة التطوير عبر query string ──────────────────────────
    if (process.env.NODE_ENV !== 'production' && req.query.__tenant) {
      tenant = await Tenant.findOne({ subdomain: req.query.__tenant, active: true }).populate('plan').lean();
    }

    // ─── فحص السوبر أدمن (admin.platform.com) ────────────────────────────
    if (!tenant && (parts[0] === 'admin' || host === process.env.SUPER_ADMIN_DOMAIN)) {
      req.isSuperAdmin = true;
      return next();
    }

    // ─── محاولة دومين مخصص ───────────────────────────────────────────────
    if (!tenant && parts.length >= 2) {
      // إذا لم يكن subdomain من منصتنا (مثلاً مش .platform.com)
      const platformBase = process.env.PLATFORM_DOMAIN || 'localhost';
      if (!host.endsWith(`.${platformBase}`) && host !== platformBase) {
        tenant = await Tenant.findOne({ domain: host, active: true }).populate('plan').lean();
      }
    }

    // ─── محاولة subdomain ────────────────────────────────────────────────
    if (!tenant && parts.length >= 2) {
      const platformBase = process.env.PLATFORM_DOMAIN || 'localhost';
      if (host.endsWith(`.${platformBase}`) || host.endsWith('.localhost')) {
        tenant = await Tenant.findOne({ subdomain: parts[0], active: true }).populate('plan').lean();
      }
    }

    // ─── الوصول المباشر عبر IP أو localhost: اختر متجرًا افتراضيًا ────────
    if (!tenant && isIpAddress(host)) {
      if (process.env.DEFAULT_TENANT_SUBDOMAIN) {
        tenant = await Tenant.findOne({
          subdomain: process.env.DEFAULT_TENANT_SUBDOMAIN.toLowerCase(),
          active: true
        }).populate('plan').lean();
      }

      if (!tenant) {
        tenant = await Tenant.findOne({ active: true }).sort({ createdAt: 1 }).populate('plan').lean();
      }
    }

    // ─── بيئة التطوير: استخدام أول متجر متاح تلقائياً ──────────────────
    if (!tenant && process.env.NODE_ENV !== 'production') {
      tenant = await Tenant.findOne({ active: true }).populate('plan').lean();
    }

    if (!tenant) {
      return res.status(404).render('404', { title: 'المتجر غير موجود', storeName: 'Platform', isAdmin: false, cartCount: 0 });
    }

    // ─── تمرير بيانات المتجر لجميع القوالب ──────────────────────────────
    req.tenant              = tenant;
    res.locals.tenant       = tenant;
    res.locals.storeName    = tenant.storeName;
    res.locals.primaryColor = tenant.primaryColor  || '#EC4899';
    res.locals.currency     = tenant.currency      || 'د.ع';
    res.locals.instagram    = tenant.instagram     || '#';
    res.locals.tiktok       = tenant.tiktok        || '#';
    res.locals.telegram     = tenant.telegram      || '#';
    res.locals.facebook     = tenant.facebook      || '#';
    res.locals.whatsapp     = tenant.whatsapp      || '';
    res.locals.poweredByVisible = tenant.poweredByVisible !== false;

    next();
  } catch (err) {
    next(err);
  }
};
