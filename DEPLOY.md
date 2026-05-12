# دليل النشر على VPS Hostinger — المنفذ 6572

## المتطلبات على السيرفر
- Ubuntu 20.04 أو أحدث
- Node.js v18+
- MongoDB
- PM2

---

## الخطوة 1 — تثبيت المتطلبات على VPS

```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# تحقق من الإصدار
node -v   # يجب أن يكون 20.x
npm -v

# تثبيت MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# تثبيت PM2 لإدارة العمليات
sudo npm install -g pm2
```

---

## الخطوة 2 — رفع الملفات

### الطريقة أ: باستخدام SCP (من جهازك)
```bash
# من جهازك المحلي (Windows PowerShell أو CMD)
scp -r "C:\Users\UR Tech\Downloads\ddos-shield-0789888e9c0c8fa27f4e206b26cbca7943288771\etrr" root@YOUR_VPS_IP:/var/www/etrr
```

### الطريقة ب: باستخدام FileZilla أو WinSCP
- اتصل بالـ VPS عبر SFTP (المنفذ 22)
- ارفع مجلد `etrr` إلى `/var/www/etrr`

---

## الخطوة 3 — إعداد المتجر على VPS

```bash
# الدخول للمجلد
cd /var/www/etrr

# تثبيت الحزم
npm install --production

# نسخ ملف البيئة وتعديله
cp .env.example .env
nano .env
```

### تعديل ملف .env:
```
PORT=6572
NODE_ENV=production
MONGODB_URI=mongodb://127.0.0.1:27017/etrr_store
SESSION_SECRET=ضع_مفتاحاً_سرياً_عشوائياً_هنا_2024
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ضع_كلمة_مرور_قوية_هنا
STORE_NAME=متجر عطر | ETR
INSTAGRAM_URL=https://www.instagram.com/etrr
TIKTOK_URL=https://www.tiktok.com/@etr.iq
TELEGRAM_URL=https://t.me/ttr_ah
WHATSAPP_NUMBER=9647XXXXXXXXX
```

---

## الخطوة 4 — إضافة بيانات تجريبية (اختياري)

```bash
node scripts/seed.js
```

---

## الخطوة 5 — تشغيل المتجر بـ PM2

```bash
# تشغيل المتجر
pm2 start server.js --name etrr-store

# حفظ الإعدادات للتشغيل التلقائي عند إعادة التشغيل
pm2 save
pm2 startup

# مراقبة الـ logs
pm2 logs etrr-store

# إعادة التشغيل إذا عدّلت الأكواد
pm2 restart etrr-store
```

---

## الخطوة 6 — فتح المنفذ 6572 في جدار الحماية

```bash
sudo ufw allow 6572/tcp
sudo ufw status
```

---

## الوصول للمتجر

- **المتجر:**       http://YOUR_VPS_IP:6572
- **لوحة التحكم:** http://YOUR_VPS_IP:6572/admin

---

## (اختياري) استخدام Nginx كـ Reverse Proxy مع دومين

```bash
sudo apt install -y nginx

# إنشاء إعداد nginx
sudo nano /etc/nginx/sites-available/etrr
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:6572;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        alias /var/www/etrr/public/uploads;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/etrr /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL مجاني مع Let's Encrypt
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

---

## الأوامر المفيدة

```bash
pm2 status           # حالة التطبيقات
pm2 logs etrr-store  # عرض السجلات
pm2 restart etrr-store
pm2 stop etrr-store
mongosh              # الدخول لقاعدة البيانات
```
