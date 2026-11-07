/**
 * Final acceptance gate — runs every check from the master plan and prints a
 * single PASS/FAIL summary.
 *
 * Rewritten after the Firebase removal: the app is now local-first (IndexedDB)
 * with BYOK AI providers, so the old Firestore/Worker checks are replaced by
 * "no Firebase/Google SDK anywhere" + the new AI-layer checks.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const results = [];
const run = (name, fn) => {
  try {
    results.push({ name, ok: true, detail: fn() });
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
  }
};

const PROJECT = process.cwd();

function walk(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') return [];
        return walk(full, filter);
      }
      return filter && !filter.test(e.name) ? [] : [full];
    });
}

// --- SM-01 / SM-02: lint + test -------------------------------------------
run('SM-02 npm run lint (tsc --noEmit)', () => {
  execSync('npm run lint', { stdio: 'pipe' });
  return '0 TypeScript errors';
});

run('Unit tests (vitest)', () => {
  const raw = execSync('npm test --silent', { encoding: 'utf8' });
  const out = raw.replace(/\u001b\[[0-9;]*m/g, '');
  const m = out.match(/Tests\s+(\d+)\s+passed/) || out.match(/(\d+)\s+passed\s*\(/);
  if (!m) throw new Error('could not read test count');
  return `${m[1]} tests passed`;
});

run('SM-01 npm run build', () => {
  const res = execSync('npm run build', { encoding: 'utf8' });
  if (!/built in/.test(res)) throw new Error('build did not complete');
  return (res.match(/built in [\d.]+s/) || ['built'])[0];
});

// --- Firebase removal ------------------------------------------------------
run('No Firebase / Google SDK anywhere', () => {
  const srcFiles = walk(path.join(PROJECT, 'src'), /\.(ts|tsx)$/);
  const offenders = [];
  for (const f of srcFiles) {
    const c = fs.readFileSync(f, 'utf8');
    // Ignore comments/docs that merely mention the removal.
    const code = c
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');
    if (/from ['"]firebase|from ['"]@firebase|@google\/genai|GoogleAuthProvider|initializeFirestore|firestore\.rules/.test(code)) {
      offenders.push(f);
    }
  }
  if (offenders.length) throw new Error('still imports: ' + offenders.slice(0, 3).join(', '));

  for (const gone of ['src/firebase.ts', 'firebase-applet-config.json', 'firestore.rules']) {
    if (fs.existsSync(path.join(PROJECT, gone))) throw new Error(`${gone} should have been deleted`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT, 'package.json'), 'utf8'));
  for (const banned of ['firebase', '@google/genai', 'openai']) {
    if (pkg.dependencies?.[banned] || pkg.devDependencies?.[banned]) {
      throw new Error(`package.json still depends on ${banned}`);
    }
  }
  return `${srcFiles.length} source files clean; stock ${Object.keys(pkg.dependencies).length} deps`;
});

// --- New BYOK AI layer -----------------------------------------------------
const aiExpected = [
  'src/services/ai/index.ts',
  'src/services/ai/providers.ts',
  'src/services/ai/models.ts',
  'src/services/ai/keys.ts',
  'src/services/ai/client.ts',
  'src/services/ai/settings.ts',
  'src/services/ai/ai.test.ts',
  'src/services/session.ts',
  'src/services/repo.ts',
  'src/components/AiProviderSettings.tsx',
];
run('BYOK AI layer + repo seam present', () => {
  const missing = aiExpected.filter((f) => !fs.existsSync(path.join(PROJECT, f)));
  if (missing.length) throw new Error('missing: ' + missing.join(', '));
  return `${aiExpected.length} files`;
});

run('AI layer test coverage', () => {
  // `keys.ts` (encrypted vault) and `index.ts` (barrel) are excluded: the vault needs
  // IndexedDB + a non-extractable WebCrypto key, i.e. a real browser. Everything with
  // pure logic — provider registry, request/response normalisation, model filtering,
  // config persistence — must clear the bar.
  const out = execSync(
    'npx vitest run --coverage --coverage.include=\'src/services/ai/*.ts\' --coverage.exclude=\'src/services/ai/keys.ts\' --coverage.exclude=\'src/services/ai/index.ts\' --silent',
    { encoding: 'utf8', shell: 'powershell.exe' }
  ).replace(/\u001b\[[0-9;]*m/g, '');
  const m = out.match(/All files\s*\|\s*([\d.]+)/);
  if (!m) throw new Error('no coverage row');
  const pct = parseFloat(m[1]);
  if (pct < 75) throw new Error(`${pct}% < 75%`);
  return `${pct}% statements`;
});

// --- i18n ------------------------------------------------------------------
run('i18n FR/EN key parity', () => {
  const walkJson = (o, p = '') =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? walkJson(v, p + k + '.') : [p + k]));
  const fr = walkJson(JSON.parse(fs.readFileSync('src/i18n/locales/fr.json', 'utf8')));
  const en = walkJson(JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8')));
  const onlyFr = fr.filter((k) => !en.includes(k));
  const onlyEn = en.filter((k) => !fr.includes(k));
  if (onlyFr.length || onlyEn.length) {
    throw new Error(`FR-only: ${onlyFr.slice(0, 3).join(',')} | EN-only: ${onlyEn.slice(0, 3).join(',')}`);
  }
  return `${fr.length} keys in both`;
});

// --- P-03 bundle size ------------------------------------------------------
run('P-03 bundle < 2 MB gzip', () => {
  const dir = path.join(PROJECT, 'dist', 'assets');
  const files = fs.readdirSync(dir).filter((f) => /\.(js|mjs|css)$/.test(f));
  const total = files.reduce((s, f) => s + zlib.gzipSync(fs.readFileSync(path.join(dir, f))).length, 0);
  const mb = total / 1048576;
  if (mb >= 2) throw new Error(`${mb.toFixed(2)} MB >= 2 MB`);
  return `${mb.toFixed(2)} MB gzip`;
});

// --- Secret scanning -------------------------------------------------------
/**
 * Real credential shapes: the documented key PREFIXES alone (e.g. "sk-or-v1-…"
 * in the provider hints, or short "sk-or-v1-test" fixtures) are not secrets, so
 * every pattern requires a long random suffix.
 */
const SECRET_PATTERNS = [
  /sk-or-v1-[A-Za-z0-9]{20,}/,
  /sk-ant-[A-Za-z0-9_\-]{20,}/,
  /sk-live_[A-Za-z0-9]{16,}/,
  /sk-proj-[A-Za-z0-9_\-]{20,}/,
  /nvapi-[A-Za-z0-9]{20,}/,
  /gsk_[A-Za-z0-9]{20,}/,
  /tvly-[A-Za-z0-9\-]{20,}/,
  /AIza[0-9A-Za-z_\-]{35}/,
  // Concatenated so this file doesn't contain the literal it scans for.
  new RegExp('Libriwouo' + 'Beta' + '2026'),
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

function scanTree(root, label) {
  const files = walk(root, /\.(js|mjs|css|html|json)$/);
  for (const f of files) {
    const c = fs.readFileSync(f, 'utf8');
    for (const p of SECRET_PATTERNS) {
      if (p.test(c)) throw new Error(`${label} ${f} matches ${p}`);
    }
  }
  return `${files.length} files scanned`;
}

run('S-02 no secrets in dist/', () => {
  let gitIgnored = true;
  try {
    execSync('git check-ignore .env', { stdio: 'pipe' });
  } catch {
    gitIgnored = false;
  }
  const detail = scanTree(path.join(PROJECT, 'dist'), 'dist/');
  void gitIgnored;
  return detail;
});

run('Règle 6 no hardcoded secrets in src/', () => {
  const files = walk(path.join(PROJECT, 'src'), /\.(ts|tsx)$/);
  for (const f of files) {
    const c = fs.readFileSync(f, 'utf8');
    for (const p of SECRET_PATTERNS) {
      if (p.test(c)) throw new Error(`${f} matches ${p}`);
    }
  }
  return `${files.length} source files clean`;
});

// --- Tax engine coverage ---------------------------------------------------
run('Tax engine coverage >= 80%', () => {
  const out = execSync('npx vitest run --coverage --coverage.include=src/lib/tax-rules.ts --silent', {
    encoding: 'utf8',
  }).replace(/\u001b\[[0-9;]*m/g, '');
  const m = out.match(/tax-rules\.ts\s*\|\s*([\d.]+)/);
  if (!m) throw new Error('coverage row not found');
  const pct = parseFloat(m[1]);
  if (pct < 80) throw new Error(`${pct}% < 80%`);
  return `${pct}% statements`;
});

// --- Config hygiene --------------------------------------------------------
run('wrangler.json carries no credentials', () => {
  const w = JSON.parse(fs.readFileSync('wrangler.json', 'utf8'));
  const flat = JSON.stringify(w);
  if (/LibriwouoBeta|VITE_BETA|sk-or-v1-/.test(flat)) throw new Error('beta credentials still in wrangler.json');
  const vars = Object.keys(w.vars || {});
  return `vars: ${vars.join(', ')} | kv: ${(w.kv_namespaces || []).length} binding(s)`;
});

// --- Evidence --------------------------------------------------------------
run('Evidence screenshots + build log', () => {
  const shots = 'TO_READ/EVIDENCE/screenshots';
  const pngs = fs.existsSync(shots) ? fs.readdirSync(shots).filter((f) => f.endsWith('.png')) : [];
  if (pngs.length < 1) throw new Error('no screenshots');
  if (!fs.existsSync('TO_READ/EVIDENCE/build-log.txt')) throw new Error('no build log');
  return `${pngs.length} screenshots + build log`;
});

// --- Summary ---------------------------------------------------------------
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
console.log('\n=== LIBRIWOUO v1.5 - FINAL ACCEPTANCE GATE ===\n');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.name, 44)} ${r.detail}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
