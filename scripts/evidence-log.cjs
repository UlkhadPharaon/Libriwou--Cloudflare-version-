/**
 * Regenerates TO_READ/EVIDENCE/build-log.txt from the real quality gates.
 * Usage: node scripts/evidence-log.cjs
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG = 'TO_READ/EVIDENCE/build-log.txt';
const parts = [];

/** Strips ANSI colour codes so the log is readable as plain text (GitHub, editors). */
const clean = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');

const run = (label, cmd) => {
  parts.push(`--- ${label} ---`);
  try {
    parts.push(clean(execSync(cmd, { encoding: 'utf8' })));
  } catch (e) {
    parts.push(clean((e.stdout || '') + (e.stderr || '')));
  }
  parts.push('');
};

parts.push('=== LIBRIWOUO v1.5 - POST-FIREBASE-REMOVAL BUILD LOG ===');
parts.push(`Generated: ${new Date().toISOString()}`);
parts.push('');
parts.push('Architecture: local-first (IndexedDB) + BYOK multi-provider AI.');
parts.push('Firebase, Google OAuth, Firestore rules and the server-side AI handlers are removed.');
parts.push('');

run('npm run lint (tsc --noEmit)', 'npm run lint');
run('npm test (vitest)', 'npm test');
run('npm run build', 'npm run build');
run('acceptance gate', 'node scripts/acceptance-gate.cjs');
run('bundle report', 'node scripts/bundle-report.cjs');

// Secret scan (real credential shapes only — bare prefixes are documented hints).
// Concatenated so this file doesn't contain the literal it scans for.
const patterns = [
  'sk-or-v1-[A-Za-z0-9]{20,}',
  'sk-ant-[A-Za-z0-9_-]{20,}',
  'sk-live_[A-Za-z0-9]{16,}',
  'nvapi-[A-Za-z0-9]{20,}',
  'gsk_[A-Za-z0-9]{20,}',
  'tvly-[A-Za-z0-9-]{20,}',
  'AIza[0-9A-Za-z_-]{35}',
  'Libriwouo' + 'Beta' + '2026',
  'BEGIN PRIVATE KEY',
];
const walk = (dir, re) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return walk(full, re);
        return re.test(e.name) ? [full] : [];
      })
    : [];
const distFiles = walk('dist', /\.(js|mjs|css|html|json)$/);
const leaks = [];
for (const f of distFiles) {
  const c = fs.readFileSync(f, 'utf8');
  for (const p of patterns) if (new RegExp(p).test(c)) leaks.push(`${f} matches ${p}`);
}
parts.push('--- secret scan on dist/ (S-02) ---');
parts.push(leaks.length ? 'RESULT: FAIL\n' + leaks.join('\n') : `RESULT: PASS — ${distFiles.length} files scanned, no real credentials`);
parts.push('');

// Firebase scan
const srcFiles = walk('src', /\.(ts|tsx)$/);
const fbOffenders = srcFiles.filter((f) => {
  const code = fs
    .readFileSync(f, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  return /from ['"](firebase|@firebase)/.test(code);
});
parts.push('--- firebase / google SDK references ---');
parts.push(fbOffenders.length ? 'RESULT: FAIL\n' + fbOffenders.join('\n') : `RESULT: PASS — ${srcFiles.length} source files, no Firebase imports`);
parts.push('');

fs.writeFileSync(LOG, parts.join('\n'), 'utf8');
console.log(`wrote ${LOG} (${fs.statSync(LOG).size} bytes)`);
