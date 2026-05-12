const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', async () => {
  console.log('✅ Connected to VPS\n');

  function run(cmd, timeout = 90000) {
    return new Promise((resolve) => {
      let out = '';
      process.stdout.write(`\n▶ Running: ${cmd.substring(0, 80)}...\n`);
      conn.exec(cmd, (err, stream) => {
        if (err) return resolve('ERROR: ' + err.message);
        const t = setTimeout(() => { stream.close(); resolve(out); }, timeout);
        stream
          .on('close', () => { clearTimeout(t); resolve(out); })
          .on('data', (d) => { out += d; process.stdout.write(d.toString()); })
          .stderr.on('data', (d) => { process.stderr.write('\x1b[33m' + d.toString() + '\x1b[0m'); });
      });
    });
  }

  // Step 1: Wait for apt lock to be free
  console.log('=== Step 1: Waiting for apt lock ===');
  await run('while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 3; done; echo "lock_free"', 120000);

  // Step 2: Fix GPG with --batch flag
  console.log('\n=== Step 2: Setting up MongoDB GPG key ===');
  await run('curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --batch --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor', 30000);

  // Step 3: Add MongoDB repo
  console.log('\n=== Step 3: Adding MongoDB repository ===');
  await run("echo 'deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse' > /etc/apt/sources.list.d/mongodb-org-8.0.list", 10000);

  // Step 4: apt-get update
  console.log('\n=== Step 4: apt-get update ===');
  await run('DEBIAN_FRONTEND=noninteractive apt-get update -qq', 60000);

  // Step 5: Install MongoDB
  console.log('\n=== Step 5: Installing MongoDB (may take 2-3 minutes) ===');
  await run('DEBIAN_FRONTEND=noninteractive apt-get install -y mongodb-org', 300000);

  // Step 6: Start MongoDB
  console.log('\n=== Step 6: Starting MongoDB ===');
  await run('systemctl start mongod && systemctl enable mongod', 15000);
  const mongoStatus = await run('systemctl is-active mongod', 5000);
  console.log('MongoDB status:', mongoStatus.trim());

  // Step 7: Run seed script
  console.log('\n=== Step 7: Seeding database ===');
  await run('cd /var/www/etrr && node scripts/seed.js', 30000);

  // Step 8: Restart PM2 app
  console.log('\n=== Step 8: Restarting etrr-store with PM2 ===');
  await run('pm2 restart etrr-store', 15000);

  // Step 9: Check PM2 logs
  console.log('\n=== Step 9: PM2 Logs ===');
  await run('sleep 3 && pm2 logs etrr-store --lines 20 --nostream 2>&1', 15000);

  // Step 10: Final HTTP check
  console.log('\n=== Step 10: HTTP check ===');
  const httpCode = await run('curl -s -o /dev/null -w "%{http_code}" http://localhost:6572/', 15000);
  
  // Step 11: PM2 startup
  console.log('\n=== Step 11: PM2 startup on reboot ===');
  await run('pm2 save', 10000);

  conn.end();

  console.log('\n\n====================================');
  if (httpCode.includes('200') || httpCode.includes('30')) {
    console.log('🎉 SUCCESS! Store is running!');
  } else {
    console.log('⚠️  HTTP code: ' + httpCode.trim() + ' (check logs above)');
  }
  console.log('🌐 URL: http://187.124.163.184:6572');
  console.log('🔒 Admin: http://187.124.163.184:6572/admin');
  console.log('👤 user: admin | pass: admin123');
  console.log('====================================\n');
});

conn.on('error', (err) => {
  console.error('❌ SSH Error:', err.message);
  process.exit(1);
});

conn.connect({
  host: '187.124.163.184',
  port: 22,
  username: 'root',
  password: 'Moh97@@@@@@@',
  readyTimeout: 30000,
  hostVerifier: () => true,
});
