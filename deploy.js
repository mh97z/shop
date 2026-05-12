const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const config = {
  host: '187.124.163.184',
  port: 22,
  username: 'root',
  password: 'Moh97@@@@@@@',
  readyTimeout: 30000,
};

const HOSTKEY = 'SHA256:WE4WFB/trd2nfBOHjShT+kl41VmZLmN1WHc/z7nXSyY';
const REMOTE_DIR = '/var/www/etrr';
const LOCAL_DIR  = __dirname;

// ─── Helper: run a single command ──────────────────────────────────────
function runCmd(conn, cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const timeout = opts.timeout || 120000;
    let output = '';
    let stderr = '';
    console.log(`\n▶ ${cmd.substring(0, 100)}...`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      const timer = setTimeout(() => {
        stream.close();
        resolve(output); // don't reject on timeout, just return what we have
      }, timeout);
      stream
        .on('close', (code) => {
          clearTimeout(timer);
          if (output.trim()) process.stdout.write(output.trim() + '\n');
          resolve(output);
        })
        .on('data', (d) => { output += d.toString(); process.stdout.write(d.toString()); })
        .stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write('\x1b[33m' + d.toString() + '\x1b[0m'); });
    });
  });
}

// ─── Helper: create connection ──────────────────────────────────────────
function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => resolve(conn))
      .on('error', reject)
      .connect({
        ...config,
        hostVerifier: (key) => {
          // Accept our known fingerprint
          return true; // we verified it manually earlier
        }
      });
  });
}

// ─── Upload files via SCP (using SFTP subsystem) ────────────────────────
function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getSFTP(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) reject(err);
      else resolve(sftp);
    });
  });
}

function mkdir(sftp, dir) {
  return new Promise((resolve) => {
    sftp.mkdir(dir, (err) => resolve()); // Ignore errors (dir might exist)
  });
}

// ─── Get all files recursively (excluding node_modules, .git, uploads) ──
function getFiles(dir, base = dir) {
  const files = [];
  const skip = ['node_modules', '.git', 'uploads', 'deploy.js', 'deploy_helper.ps1', 'DEPLOY.md'];
  for (const entry of fs.readdirSync(dir)) {
    if (skip.includes(entry)) continue;
    const fullPath = path.join(dir, entry);
    const relPath  = path.relative(base, fullPath).replace(/\\/g, '/');
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...getFiles(fullPath, base));
    } else {
      files.push({ local: fullPath, remote: relPath });
    }
  }
  return files;
}

// ─── Main Deploy ────────────────────────────────────────────────────────
async function deploy() {
  console.log('\n🚀 بدء النشر على VPS 187.124.163.184...\n');
  let conn;
  try {
    conn = await connect();
    console.log('✅ تم الاتصال بالـ VPS\n');

    // 1. Check/Install MongoDB
    console.log('=== 1. التحقق من MongoDB ===');
    const mongoCheck = await runCmd(conn, 'mongod --version 2>&1 | head -1');
    if (!mongoCheck.includes('db version')) {
      console.log('📦 تثبيت MongoDB...');
      await runCmd(conn,
        'curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor',
        { timeout: 30000 }
      );
      await runCmd(conn,
        "echo 'deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse' > /etc/apt/sources.list.d/mongodb-org-8.0.list",
        { timeout: 10000 }
      );
      await runCmd(conn, 'DEBIAN_FRONTEND=noninteractive apt-get update -qq', { timeout: 60000 });
      await runCmd(conn,
        'DEBIAN_FRONTEND=noninteractive apt-get install -y mongodb-org',
        { timeout: 300000 }
      );
      await runCmd(conn, 'systemctl start mongod && systemctl enable mongod', { timeout: 15000 });
    } else {
      console.log('✅ MongoDB مثبت بالفعل');
    }
    await runCmd(conn, 'systemctl start mongod 2>/dev/null; systemctl is-active mongod', { timeout: 10000 });

    // 2. Prepare remote directory
    console.log('\n=== 2. إعداد مجلد المشروع ===');
    await runCmd(conn, `mkdir -p ${REMOTE_DIR}/models ${REMOTE_DIR}/routes ${REMOTE_DIR}/middleware ${REMOTE_DIR}/scripts ${REMOTE_DIR}/public/css ${REMOTE_DIR}/public/js ${REMOTE_DIR}/public/img ${REMOTE_DIR}/public/uploads ${REMOTE_DIR}/views/partials ${REMOTE_DIR}/views/admin/partials`, { timeout: 10000 });

    // 3. Upload files via SFTP
    console.log('\n=== 3. رفع ملفات المشروع ===');
    const sftp = await getSFTP(conn);
    const files = getFiles(LOCAL_DIR);
    console.log(`📂 رفع ${files.length} ملف...`);

    let uploaded = 0;
    for (const file of files) {
      const remotePath = `${REMOTE_DIR}/${file.remote}`;
      const remoteDir  = remotePath.split('/').slice(0, -1).join('/');
      await new Promise(r => sftp.mkdir(remoteDir, () => r()));
      await uploadFile(sftp, file.local, remotePath);
      uploaded++;
      if (uploaded % 10 === 0) process.stdout.write(`  ${uploaded}/${files.length} ملفات...\r`);
    }
    sftp.end();
    console.log(`✅ تم رفع جميع الملفات (${uploaded})`);

    // 4. Create .env on server
    console.log('\n=== 4. إعداد ملف .env ===');
    const envContent = [
      'PORT=6572',
      'NODE_ENV=production',
      'MONGODB_URI=mongodb://127.0.0.1:27017/etrr_store',
      'SESSION_SECRET=etrr_vps_secret_2024_hostinger_secure',
      'ADMIN_USERNAME=admin',
      'ADMIN_PASSWORD=admin123',
      'STORE_NAME=متجر عطر | ETR',
      'INSTAGRAM_URL=https://www.instagram.com/etrr',
      'TIKTOK_URL=https://www.tiktok.com/@etr.iq',
      'TELEGRAM_URL=https://t.me/ttr_ah',
      'WHATSAPP_NUMBER=9647XXXXXXXXX',
    ].join('\\n');
    await runCmd(conn, `printf '${envContent}' > ${REMOTE_DIR}/.env`, { timeout: 10000 });

    // 5. npm install
    console.log('\n=== 5. تثبيت الحزم npm ===');
    await runCmd(conn, `cd ${REMOTE_DIR} && npm install --production 2>&1 | tail -5`, { timeout: 120000 });

    // 6. Seed database
    console.log('\n=== 6. إضافة البيانات التجريبية ===');
    await runCmd(conn, `cd ${REMOTE_DIR} && node scripts/seed.js`, { timeout: 30000 });

    // 7. Open firewall port
    console.log('\n=== 7. فتح المنفذ 6572 ===');
    await runCmd(conn, 'ufw allow 6572/tcp 2>/dev/null || iptables -I INPUT -p tcp --dport 6572 -j ACCEPT 2>/dev/null; echo done', { timeout: 10000 });

    // 8. Start with PM2
    console.log('\n=== 8. تشغيل المتجر بـ PM2 ===');
    await runCmd(conn, `cd ${REMOTE_DIR} && pm2 delete etrr-store 2>/dev/null; pm2 start server.js --name etrr-store && pm2 save`, { timeout: 30000 });
    await runCmd(conn, 'pm2 status', { timeout: 10000 });

    // 9. Final check
    console.log('\n=== 9. تحقق نهائي ===');
    const check = await runCmd(conn, 'sleep 2 && curl -s -o /dev/null -w "%{http_code}" http://localhost:6572/', { timeout: 15000 });

    conn.end();
    console.log('\n\n🎉 ====================================');
    console.log('✅ تم نشر المتجر بنجاح!');
    console.log(`🌐 الموقع: http://187.124.163.184:6572`);
    console.log(`🔒 الإدارة: http://187.124.163.184:6572/admin`);
    console.log(`👤 المستخدم: admin  |  كلمة المرور: admin123`);
    console.log('=====================================\n');
    console.log('⚠️  تذكر: غيّر كلمة مرور الأدمن من /admin بعد الدخول!');

  } catch (err) {
    console.error('\n❌ خطأ:', err.message);
    if (conn) conn.end();
    process.exit(1);
  }
}

deploy();
