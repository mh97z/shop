const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema({
  label: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, default: 999 }
}, { _id: false });

const productSchema = new mongoose.Schema({
  tenant:      { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, default: '' },
  basePrice:   { type: Number, required: true },
  sizes:       [sizeSchema],
  images:      [String],
  category:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  tags:        [String],       // الاكثر مبيعا، جديد، منتج مميز...
  featured:    { type: Boolean, default: false },
  active:      { type: Boolean, default: true },
  soldCount:   { type: Number, default: 0 }
}, { timestamps: true });

// فهرسة للبحث النصي + مؤشر مركب للتأمين من التكرار ضمن نفس المتجر
productSchema.index({ tenant: 1, slug: 1 }, { unique: true });
productSchema.index({ tenant: 1, name: 'text', description: 'text', tags: 'text' });
productSchema.index({ tenant: 1, active: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
