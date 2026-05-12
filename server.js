require('dotenv').config();
const express        = require('express');
const mongoose       = require('mongoose');
const session        = require('express-session');
const MongoStore     = require('connect-mongo');
const helmet         = require('helmet');
const morgan         = require('morgan');
const compression    = require('compression');
const methodOverride = require('method-override');
const rateLimit      = require('express-rate-limit');
const path           = require('path');
const resolveTenant  = require('./middleware/tenant');

const app = express();

// ─── الاتصال بقاعدة البيانات ───────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ تم الاتصال بـ MongoDB'))
  .catch(err => { console.error('❌ فشل الاتصال بـ MongoDB:', err); process.exit(1); });

// ─── ضغط GZIP/Brotli ──────────────────────────────────────────────────────
app.use(compression({ level: 6, threshold: 1024 }));

// ─── إعدادات الأمان ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com", "cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc:       ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
      imgSrc:        ["'self'", "data:", "blob:", "https:"],
      connectSrc:    ["'self'"],
    },
  },
}));

// ─── حد الطلبات (حماية DDoS) ──────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'تجاوزت الحد المسموح به من الطلبات، حاول لاحقاً'
});
app.use(limiter);

// ─── إعدادات Express ────────────────────────────────────────────────────────

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// ─── محرك القوالب ──────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── الجلسات ──────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000
  }
}));

// ─── حل هوية المتجر (Tenant) من hostname ─────────────────────────────────
// استثناء مسارات السوبر أدمن من middleware المتاجر
app.use((req, res, next) => {
  if (req.path.startsWith('/superadmin')) return next();
  resolveTenant(req, res, next);
});

// ─── متغيرات عامة للقوالب ──────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.tenant            = res.locals.tenant || null;
  res.locals.cart              = req.session.cart || [];
  res.locals.cartCount         = (req.session.cart || []).reduce((s, i) => s + i.qty, 0);
  res.locals.isAdmin           = req.session.isAdmin || false;
  res.locals.storeName         = res.locals.storeName || process.env.PLATFORM_NAME || 'Platform';
  res.locals.primaryColor      = res.locals.primaryColor || '#EC4899';
  res.locals.currency          = res.locals.currency || 'د.ع';
  res.locals.instagram         = res.locals.instagram || '#';
  res.locals.tiktok            = res.locals.tiktok || '#';
  res.locals.telegram          = res.locals.telegram || '#';
  res.locals.facebook          = res.locals.facebook || '#';
  res.locals.whatsapp          = res.locals.whatsapp || '';
  res.locals.poweredByVisible  = typeof res.locals.poweredByVisible === 'boolean' ? res.locals.poweredByVisible : true;
  next();
});

// ─── المسارات ─────────────────────────────────────────────────────────────
app.use('/',          require('./routes/index'));
app.use('/products',  require('./routes/products'));
app.use('/cart',      require('./routes/cart'));
app.use('/api',       require('./routes/api'));
app.use('/admin',     require('./routes/admin'));
app.use('/superadmin',require('./routes/superadmin'));

// ─── معالج 404 ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'الصفحة غير موجودة',
    storeName: res.locals.storeName || 'Platform'
  });
});

// ─── معالج الأخطاء ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title:     'خطأ في الخادم',
    storeName: res.locals.storeName || 'Platform',
    error:     process.env.NODE_ENV === 'development' ? err.message : 'حدث خطأ داخلي'
  });
});

// ─── تشغيل السيرفر ─────────────────────────────────────────────────────────
const PORT = 1112;
app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});


