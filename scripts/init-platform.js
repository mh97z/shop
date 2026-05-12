/**
 * scripts/init-platform.js
 * سكريبت تهيئة المنصة: يُنشئ الباقات الافتراضية ومتجر تجريبي
 * الاستخدام: node scripts/init-platform.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Plan     = require('../models/Plan');
const Tenant   = require('../models/Tenant');

async function init() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ متصل بـ MongoDB');

  // ─── إنشاء الباقات الثلاث ─────────────────────────────────────────
  const existingPlans = await Plan.countDocuments();
  if (existingPlans === 0) {
    await Plan.insertMany([
      {
        name: 'Basic', nameAr: 'الأساسية',
        price: 9,
        productLimit: 20,
        bannerCount: 1,
        customDomain: false,
        analyticsEnabled: false,
        color: '#6366f1',
        popular: false,
        sortOrder: 1,
        features: [
          'حتى 20 منتج',
          'بنر ترويجي واحد',
          'سلة تسوق',
          'الدفع عند الاستلام',
          'دعم فني'
        ]
      },
      {
        name: 'Pro', nameAr: 'الاحترافية',
        price: 19,
        productLimit: 100,
        bannerCount: 3,
        customDomain: true,
        analyticsEnabled: false,
        color: '#EC4899',
        popular: true,
        sortOrder: 2,
        features: [
          'حتى 100 منتج',
          '3 بنرات ترويجية',
          'دومين مخصص',
          'سلة وطلبات',
          'إشعارات واتساب',
          'دعم أولوية'
        ]
      },
      {
        name: 'Premium', nameAr: 'المميزة',
        price: 39,
        productLimit: -1,
        bannerCount: 10,
        customDomain: true,
        analyticsEnabled: true,
        color: '#f59e0b',
        popular: false,
        sortOrder: 3,
        features: [
          'منتجات غير محدودة',
          '10 بنرات ترويجية',
          'دومين مخصص',
          'إحصائيات متقدمة',
          'إشعارات واتساب وتيليغرام',
          'دعم على مدار الساعة',
          'تخصيص الألوان'
        ]
      }
    ]);
    console.log('✅ تم إنشاء الباقات الثلاث (Basic, Pro, Premium)');
  } else {
    console.log(`ℹ️ الباقات موجودة مسبقاً (${existingPlans} باقة)`);
  }

  // ─── إنشاء متجر تجريبي إن لم يكن موجوداً ─────────────────────────
  const existingTenants = await Tenant.countDocuments();
  if (existingTenants === 0) {
    const proPlan = await Plan.findOne({ name: 'Pro' });
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await Tenant.create({
      storeName:     'متجر تجريبي',
      subdomain:     'demo',
      ownerName:     'مدير المتجر',
      ownerEmail:    'admin@demo.store',
      ownerPhone:    '',
      adminUsername: process.env.ADMIN_USERNAME || 'admin',
      adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
      plan:          proPlan?._id,
      planExpiry:    trialEnd,
      trialEnd,
      primaryColor:  '#EC4899',
      currency:      'د.ع',
      whatsapp:      process.env.WHATSAPP_NUMBER || '',
      active:        true
    });
    console.log('✅ تم إنشاء المتجر التجريبي (subdomain: demo)');
    console.log(`   اسم المستخدم: ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(`   كلمة المرور: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
  } else {
    console.log(`ℹ️ المتاجر موجودة مسبقاً (${existingTenants} متجر)`);
  }

  console.log('\n🚀 المنصة جاهزة! شغّل السيرفر بـ: npm start');
  process.exit(0);
}

init().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
