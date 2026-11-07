// Verifies that key Tailwind classes used by the refactored landing sections are
// actually present in the generated CSS (Tailwind v4 cannot see template-built names).
const fs = require('fs');
const path = require('path');

const cssDir = path.join('dist', 'assets');
const cssFiles = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'));
if (cssFiles.length === 0) {
  console.log('NO CSS FOUND â€” build may have failed');
  process.exit(1);
}
const css = cssFiles.map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
console.log('css files:', cssFiles.join(', '), '| size:', (css.length / 1024).toFixed(1) + 'KB');

// Classes that the extracted sections must emit.
const required = [
  'bg-gold-500\\/10',
  'text-gold-400',
  'border-gold-500\\/20',
  'bg-luxury-950',
  'bg-luxury-900',
  'rounded-2xl',
  'font-serif',
  'animate-pulse',
  'animate-bounce',
  'backdrop-blur-md',
];

const missing = [];
for (const cls of required) {
  // Values in `required` are already written in their escaped CSS form.
  if (!css.includes(cls)) missing.push(cls);
}

console.log(required.length - missing.length + '/' + required.length + ' key classes present');
if (missing.length) {
  console.log('MISSING: ' + missing.join(', '));
  process.exit(1);
}
console.log('TAILWIND OUTPUT OK');

// Also confirm the section source files were actually bundled.
const jsFiles = fs.readdirSync(cssDir).filter((f) => f.endsWith('.js'));
const js = jsFiles.map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
for (const marker of ['landing.whyTitle', 'landing.pricingTitle', 'landing.faqTitle', 'subscription.waitlistTitle']) {
  if (!js.includes(marker)) {
    console.log('MISSING i18n MARKER IN BUNDLE: ' + marker);
    process.exit(1);
  }
}
console.log('i18n markers present in bundle');

