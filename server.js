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

// ─── الملفات الثابتة مع Cache-Control وETag ───────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge:  process.env.NODE_ENV === 'production' ? '30d' : 0,
  etag:    true,
  lastModified: true,
  setHeaders(res, filePath) {
    // الصور: كاش شهر كامل
    if (/\.(jpg|jpeg|png|webp|avif|gif|svg|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
    // CSS/JS: كاش أسبوع
    if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

// ─── المرفوعات (Uploads) مع Cache-Control ────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
  maxAge: '30d',
  etag: true,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  }
}));

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
  res.locals.cart      = req.session.cart       || [];
  res.locals.cartCount = (req.session.cart || []).reduce((s, i) => s + i.qty, 0);
  res.locals.isAdmin   = req.session.isAdmin    || false;
  // storeName و primaryColor تأتي من middleware المتجر
  if (!res.locals.storeName) res.locals.storeName = process.env.PLATFORM_NAME || 'Platform';
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
const PORT = process.env.PORT || 6572;
app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});


// ─── الاتصال بقاعدة البيانات ───────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ تم الاتصال بـ MongoDB'))
  .catch(err => { console.error('❌ فشل الاتصال بـ MongoDB:', err); process.exit(1); });

// ─── إعدادات الأمان ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com", "cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

// حد الطلبات (حماية DDos بسيطة)
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
app.use(express.static(path.join(__dirname, 'public')));

// ─── محرك القوالب ──────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── الجلسات ──────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// ─── متغيرات عامة للقوالب ──────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.storeName  = process.env.STORE_NAME || 'متجر عطر | ETR';
  res.locals.instagram  = process.env.INSTAGRAM_URL || '#';
  res.locals.tiktok     = process.env.TIKTOK_URL || '#';
  res.locals.telegram   = process.env.TELEGRAM_URL || '#';
  res.locals.whatsapp   = process.env.WHATSAPP_NUMBER || '';
  res.locals.cart       = req.session.cart || [];
  res.locals.cartCount  = (req.session.cart || []).reduce((s, i) => s + i.qty, 0);
  res.locals.isAdmin    = req.session.isAdmin || false;
  next();
});

// ─── المسارات ─────────────────────────────────────────────────────────────
app.use('/',        require('./routes/index'));
app.use('/products', require('./routes/products'));
app.use('/cart',    require('./routes/cart'));
app.use('/api',     require('./routes/api'));
app.use('/admin',   require('./routes/admin'));

// ─── معالج الأخطاء ────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', { title: 'الصفحة غير موجودة' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { title: 'خطأ في الخادم', error: process.env.NODE_ENV === 'development' ? err.message : 'حدث خطأ داخلي' });
});

// ─── تشغيل السيرفر ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 6572;
app.listen(PORT, () => {
  console.log(`🚀 المتجر يعمل على المنفذ ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});
