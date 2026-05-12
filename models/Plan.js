const mongoose = require('mongoose');

// ─── نموذج باقات الاشتراك ────────────────────────────────────────────────
const planSchema = new mongoose.Schema({
  name:         { type: String, required: true },       // Basic / Pro / Premium
  nameAr:       { type: String, required: true },       // الأساسية / الاحترافية / المميزة
  price:        { type: Number, required: true },       // السعر الشهري بالدولار
  productLimit: { type: Number, default: 20 },          // حد المنتجات (-1 = غير محدود)
  orderLimit:   { type: Number, default: -1 },          // حد الطلبات الشهرية (-1 = غير محدود)
  features: [String],                                   // قائمة المزايا
  customDomain: { type: Boolean, default: false },      // دعم الدومين المخصص
  analyticsEnabled: { type: Boolean, default: false },  // إحصائيات متقدمة
  bannerCount:  { type: Number, default: 1 },           // عدد البنرات
  color:        { type: String, default: '#6366f1' },   // لون الباقة
  popular:      { type: Boolean, default: false },      // الأكثر شعبية
  sortOrder:    { type: Number, default: 0 },
  active:       { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
