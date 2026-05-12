const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  tenant:    { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name:      { type: String, required: true, trim: true },
  slug:      { type: String, required: true, trim: true, lowercase: true },
  image:     { type: String, default: '' },   // صورة دائرية للفئة
  order:     { type: Number, default: 0 },
  active:    { type: Boolean, default: true }
}, { timestamps: true });

categorySchema.index({ tenant: 1, slug: 1 }, { unique: true });
categorySchema.index({ tenant: 1, active: 1, order: 1 });

module.exports = mongoose.model('Category', categorySchema);
