const express = require('express');
const router  = express.Router();
const Product = require('../models/Product');
const Order   = require('../models/Order');

// عرض السلة
router.get('/', (req, res) => {
  const cart  = req.session.cart || [];
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  res.render('cart', { title: 'سلة التسوق', cart, total });
});

// إضافة منتج للسلة
router.post('/add', async (req, res) => {
  try {
    const { productId, size, qty = 1 } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'المنتج غير موجود' });

    if (!req.session.cart) req.session.cart = [];

    // تحديد السعر بناءً على الحجم
    let price = product.basePrice;
    if (size && product.sizes.length > 0) {
      const sizeObj = product.sizes.find(s => s.label === size);
      if (sizeObj) price = sizeObj.price;
    }

    const cartKey = `${productId}-${size || 'default'}`;
    const existing = req.session.cart.find(i => i.cartKey === cartKey);

    if (existing) {
      existing.qty += +qty;
    } else {
      req.session.cart.push({
        cartKey,
        productId: productId.toString(),
        name:  product.name,
        image: product.images[0] || '/img/placeholder.png',
        size:  size || 'افتراضي',
        price,
        qty:   +qty
      });
    }

    const cartCount = req.session.cart.reduce((s, i) => s + i.qty, 0);
    res.json({ success: true, cartCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// تحديث الكمية
router.post('/update', (req, res) => {
  const { cartKey, qty } = req.body;
  if (!req.session.cart) return res.redirect('/cart');

  if (+qty <= 0) {
    req.session.cart = req.session.cart.filter(i => i.cartKey !== cartKey);
  } else {
    const item = req.session.cart.find(i => i.cartKey === cartKey);
    if (item) item.qty = +qty;
  }
  res.redirect('/cart');
});

// حذف عنصر
router.post('/remove', (req, res) => {
  const { cartKey } = req.body;
  if (req.session.cart)
    req.session.cart = req.session.cart.filter(i => i.cartKey !== cartKey);
  res.redirect('/cart');
});

// صفحة إتمام الطلب
router.get('/checkout', (req, res) => {
  const cart  = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  res.render('checkout', { title: 'إتمام الطلب', cart, total });
});

// تأكيد الطلب
router.post('/checkout', async (req, res) => {
  try {
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect('/cart');

    const { name, phone, address, notes, channel } = req.body;
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

    const order = new Order({
      tenant:   req.tenant._id,
      customer: { name, phone, address, notes: notes || '' },
      items: cart.map(i => ({
        product: i.productId,
        name:    i.name,
        image:   i.image,
        size:    i.size,
        price:   i.price,
        qty:     i.qty
      })),
      total,
      paymentMethod: 'cod',
      channel: channel || 'direct'
    });

    await order.save();
    req.session.cart = [];

    const tenant = req.tenant;
    const waMsg  = buildOrderMessage(order, tenant.storeName);

    res.render('order-success', {
      title:    'تم استلام طلبك',
      order,
      waMsg:    encodeURIComponent(waMsg),
      whatsapp: tenant.whatsapp,
      telegram: tenant.telegram
    });
  } catch (err) {
    res.status(500).render('error', { title: 'خطأ', error: err.message });
  }
});

function buildOrderMessage(order, storeName) {
  let msg = `🛍️ *طلب جديد من ${storeName}*\n`;
  msg += `رقم الطلب: ${order.orderNumber}\n`;
  msg += `الاسم: ${order.customer.name}\n`;
  msg += `الهاتف: ${order.customer.phone}\n`;
  msg += `العنوان: ${order.customer.address}\n`;
  msg += `طريقة الدفع: الدفع عند الاستلام 💵\n\n`;
  msg += `*المنتجات:*\n`;
  order.items.forEach(item => {
    msg += `• ${item.name} (${item.size}) × ${item.qty} = ${(item.price * item.qty).toLocaleString()} د.ع\n`;
  });
  msg += `\n*المجموع: ${order.total.toLocaleString()} د.ع*`;
  if (order.customer.notes) msg += `\nملاحظات: ${order.customer.notes}`;
  return msg;
}

module.exports = router;
