const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', async () => {
  function run(cmd, timeout = 30000) {
    return new Promise((resolve) => {
      let out = '';
      process.stdout.write(`\n▶ ${cmd}\n`);
      conn.exec(cmd, (err, stream) => {
        if (err) return resolve('ERROR: ' + err.message);
        const t = setTimeout(() => { stream.close(); resolve(out); }, timeout);
        stream
          .on('close', () => { clearTimeout(t); resolve(out); })
          .on('data', (d) => { out += d; process.stdout.write(d.toString()); })
          .stderr.on('data', (d) => process.stderr.write('\x1b[33m' + d.toString() + '\x1b[0m'));
      });
    });
  }

  // Check what's listening on 6572
  await run('ss -tlnp | grep 6572 || echo "NOT LISTENING"');
  // Check pm2 status + logs
  await run('pm2 status');
  await run('pm2 logs etrr-store --lines 30 --nostream 2>&1');
  // Check if server binds to all interfaces
  await run('ss -tlnp | grep node');
  // Check .env
  await run('cat /var/www/etrr/.env');
  // Check server.js port config
  await run('head -20 /var/www/etrr/server.js');
  // Try curl with -v
  await run('curl -v http://127.0.0.1:6572/ 2>&1 | head -30', 10000);
  // Check mongod
  await run('systemctl is-active mongod && mongo --eval "db.adminCommand({ ping: 1 })" 2>/dev/null || mongosh --eval "db.adminCommand({ ping: 1 })" 2>/dev/null');
  
  conn.end();
});
conn.on('error', (e) => console.error(e.message));
conn.connect({
  host: '187.124.163.184', port: 22, username: 'root', password: 'Moh97@@@@@@@',
  readyTimeout: 30000, hostVerifier: () => true,
});
