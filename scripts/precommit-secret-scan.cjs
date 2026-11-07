#!/usr/bin/env node
/**
 * Pre-commit secret scan.
 *
 * Scans the STAGED content (index, not working tree) for real credential shapes.
 * Bare prefixes like "sk-or-v1-…" are documented UI hints and are ignored on purpose:
 * every pattern requires a long random suffix.
 *
 * Exits non-zero when anything is found, so `git commit` is aborted.
 */
const { execSync } = require('child_process');

const PATTERNS = [
  ['OpenRouter key', /sk-or-v1-[A-Za-z0-9]{20,}/],
  ['Anthropic key', /sk-ant-[A-Za-z0-9_\-]{20,}/],
  ['OpenAI live key', /sk-live_[A-Za-z0-9]{16,}/],
  ['OpenAI project key', /sk-proj-[A-Za-z0-9_\-]{20,}/],
  ['NVIDIA key', /nvapi-[A-Za-z0-9]{20,}/],
  ['Groq key', /gsk_[A-Za-z0-9]{20,}/],
  ['Tavily key', /tvly-[A-Za-z0-9\-]{20,}/],
  ['Firebase web key', /AIza[0-9A-Za-z_\-]{35}/],
  // Built by concatenation so this file does not contain the literal it looks for
  // (otherwise the scanner would flag itself).
  ['Legacy beta password', new RegExp('Libriwouo' + 'Beta' + '2026')],
  ['Google OAuth client secret', /GOCSPX-[A-Za-z0-9_\-]{10,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Generic bearer token', /Bearer\s+[A-Za-z0-9_\-]{40,}/],
];

/**
 * Documentation legitimately NAMES a credential that was rotated, so the reader
 * knows exactly what to revoke. Those mentions are allowed in prose only.
 */
const PROSE_ALLOWLIST = [
  [/\.md$/i, 'Legacy beta password'],
];

// Files that legitimately contain prefixed-but-fake values for tests.
const ALLOWLIST = [
  // test fixtures: short, obviously-not-real values
];

let stagedFiles = [];
try {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
  stagedFiles = out.split(/\r?\n/).filter(Boolean);
} catch (e) {
  console.error('Could not read staged files:', e.message);
  process.exit(1);
}

if (stagedFiles.length === 0) {
  console.log('No staged files to scan.');
  process.exit(0);
}

const findings = [];

for (const rel of stagedFiles) {
  if (ALLOWLIST.some((a) => rel.includes(a))) continue;
  if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|db|zip|pdf)$/i.test(rel)) continue;

  let content;
  try {
    content = execSync(`git show ":${rel}"`, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch {
    continue; // binary or unreadable — nothing to match as text
  }

  for (const [label, re] of PATTERNS) {
    // Prose files may NAME a credential that was already rotated.
    if (PROSE_ALLOWLIST.some(([fileRe, rule]) => fileRe.test(rel) && rule === label)) continue;
    const m = content.match(re);
    if (m) {
      findings.push(`${rel} — ${label}: ${m[0].slice(0, 24)}…`);
    }
  }
}

// Blocklist: files that must never be committed.
const forbidden = stagedFiles.filter((f) => /^\.env$/.test(f) || f === '.env');
if (forbidden.length) findings.push(`forbidden file staged: ${forbidden.join(', ')}`);

if (findings.length) {
  console.error('\n❌ SECRET SCAN FAILED — do NOT push\n');
  findings.forEach((f) => console.error('  ' + f));
  console.error('\nFix: unstage the offending file, or rewrite history if it was ever committed.\n');
  process.exit(1);
}

console.log(`✅ Secret scan passed — ${stagedFiles.length} staged files clean.`);
