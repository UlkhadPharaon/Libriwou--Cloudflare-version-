---
note: 'Helper scripts kept for the operations team. They are dev tooling, not shipped code.'
---

# scripts/

Operational helpers used during the Phase 1–6 engineering pass.

| Script | Purpose | Usage |
|---|---|---|
| `bundle-report.cjs` | Raw / gzip / brotli size per emitted chunk in `dist/assets`. Gates test **P-03** (bundle < 2 MB gzipped). | `node scripts/bundle-report.cjs` (after `npm run build`) |
| `verify-css.cjs` | Confirms the key Tailwind classes are actually present in the generated CSS. Catches broken dynamic class names after a refactor. | `node scripts/verify-css.cjs` (after `npm run build`) |
| `acceptance-gate.cjs` | Runs **every** acceptance check from the master plan (lint, tests, build, bundle size, secret scan, Firestore rules, i18n parity, coverage) and prints one PASS/FAIL summary. | `node scripts/acceptance-gate.cjs` |
| `optimize-assets.py` | Re-runs the Phase 6.2 asset optimization (downscale + PNG optimize) for `public/favicon.png`, `public/logo-main.png`, `public/mascotte.png`. Backs up nothing — run it on assets you control. | `python scripts/optimize-assets.py` |

All four are **not** part of the production build (`npm run build` does not touch them).

> **Known non-zero exit:** `acceptance-gate.cjs` reports one expected FAIL — *S-02 no secrets in dist/*.
> A local build inlines `VITE_BETA_PASSWORD` from the git-ignored `.env`, so the beta password
> appears in `dist/`. CI builds have no `.env`, so the same check passes there. Either way the
> password is compromised (it is in git history) and must be rotated — see
> `FINAL_ENGINEERING_REPORT.md`, section 5, Bloquant 1.
