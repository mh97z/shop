// middleware/auth.js — التحقق من صلاحيات مدير المتجر
module.exports = function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin/login');
};

// التحقق من صلاحيات السوبر أدمن (مدير المنصة)
module.exports.requireSuperAdmin = function(req, res, next) {
  if (req.session && req.session.isSuperAdmin) return next();
  res.redirect('/superadmin/login');
};
