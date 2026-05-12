const mongoose = require('mongoose');

// ─── نموذج المستأجر (المتجر) ─────────────────────────────────────────────
const tenantSchema = new mongoose.Schema({
  // ─── هوية المتجر ─────────────────────────────────────────────────────────
  storeName:    { type: String, required: true, trim: true },   // اسم المتجر
  subdomain:    { type: String, required: true, unique: true, lowercase: true, trim: true }, // store.platform.com
  domain:       { type: String, default: '', lowercase: true }, // دومين مخصص (Pro+)
  logo:         { type: String, default: '' },                  // مسار الشعار
  description:  { type: String, default: '' },                  // وصف المتجر

  // ─── بيانات المالك ───────────────────────────────────────────────────────
  ownerName:    { type: String, required: true },
  ownerEmail:   { type: String, required: true, unique: true, lowercase: true },
  ownerPhone:   { type: String, default: '' },
  adminUsername:{ type: String, required: true },
  adminPassword:{ type: String, required: true },               // نص عادي (يُشفَّر في الإنشاء)

  // ─── الاشتراك ────────────────────────────────────────────────────────────
  plan:         { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  planStartDate:{ type: Date, default: Date.now },
  planExpiry:   { type: Date },                                 // تاريخ انتهاء الاشتراك
  trialEnd:     { type: Date },                                 // نهاية الفترة التجريبية

  // ─── التصميم والمظهر ─────────────────────────────────────────────────────
  primaryColor: { type: String, default: '#EC4899' },           // اللون الرئيسي
  accentColor:  { type: String, default: '#F9A8D4' },           // لون الإضافة
  currency:     { type: String, default: 'د.ع' },              // العملة
  currencyCode: { type: String, default: 'IQD' },

  // ─── روابط التواصل ───────────────────────────────────────────────────────
  whatsapp:     { type: String, default: '' },
  instagram:    { type: String, default: '#' },
  tiktok:       { type: String, default: '#' },
  telegram:     { type: String, default: '#' },
  facebook:     { type: String, default: '#' },

  // ─── الإعدادات ───────────────────────────────────────────────────────────
  active:       { type: Boolean, default: true },
  poweredByVisible: { type: Boolean, default: true },           // إظهار "Powered by Platform"
  banners: [{
    image: String,
    title: String,
    subtitle: String,
    link: String,
    active: { type: Boolean, default: true }
  }]
}, { timestamps: true });

// فهرسة للبحث السريع
tenantSchema.index({ subdomain: 1 });
tenantSchema.index({ domain: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);
