// Gzip/brotli size report for dist/assets (Phase 6.2 — test P-03).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const dir = path.join('dist', 'assets');
const files = fs.readdirSync(dir).filter((f) => /\.(js|mjs|css|html)$/.test(f));

let gzTotal = 0;
let brTotal = 0;
const rows = [];
for (const f of files) {
  const buf = fs.readFileSync(path.join(dir, f));
  const gz = zlib.gzipSync(buf, { level: 9 }).length;
  const br = zlib.brotliCompressSync(buf).length;
  gzTotal += gz;
  brTotal += br;
  rows.push({ f, raw: buf.length, gz, br });
}

rows.sort((a, b) => b.gz - a.gz);
console.log('file'.padEnd(34), 'raw KB'.padStart(10), 'gzip KB'.padStart(10), 'br KB'.padStart(10));
for (const r of rows) {
  console.log(
    r.f.padEnd(34),
    (r.raw / 1024).toFixed(1).padStart(10),
    (r.gz / 1024).toFixed(1).padStart(10),
    (r.br / 1024).toFixed(1).padStart(10)
  );
}
console.log('-'.repeat(68));
console.log(
  'TOTAL'.padEnd(34),
  (rows.reduce((s, r) => s + r.raw, 0) / 1024).toFixed(1).padStart(10),
  (gzTotal / 1024).toFixed(1).padStart(10),
  (brTotal / 1024).toFixed(1).padStart(10)
);

console.log('\nP-03 target: total bundle < 2 MB gzipped');
console.log((gzTotal / 1048576).toFixed(2) + ' MB gzip / ' + (brTotal / 1048576).toFixed(2) + ' MB brotli');

// PWA precache weight is a separate mobile concern.
const swPath = path.join('dist', 'sw.js');
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8');
  const m = sw.match(/"revision":"[^"]*","url":"([^"]+)"/g) || [];
  console.log('\nPWA precache entries:', m.length);
}
