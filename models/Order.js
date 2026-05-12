const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:      { type: String, required: true },
  image:     { type: String },
  size:      { type: String, default: 'افتراضي' },
  price:     { type: Number, required: true },
  qty:       { type: Number, required: true, min: 1 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  tenant:      { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  orderNumber: { type: String },
  customer: {
    name:    { type: String, required: true, trim: true },
    phone:   { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    notes:   { type: String, default: '' }
  },
  items:    [orderItemSchema],
  total:    { type: Number, required: true },
  status:   { type: String, enum: ['pending','confirmed','shipped','delivered','cancelled'], default: 'pending' },
  paymentMethod: { type: String, default: 'cod' },   // cod = الدفع عند الاستلام
  channel:  { type: String, enum: ['whatsapp','telegram','direct'], default: 'direct' }
}, { timestamps: true });

orderSchema.index({ tenant: 1, createdAt: -1 });
orderSchema.index({ tenant: 1, status: 1 });

// توليد رقم الطلب تلقائياً
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = 'ETR-' + String(count + 1).padStart(5, '0');
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
