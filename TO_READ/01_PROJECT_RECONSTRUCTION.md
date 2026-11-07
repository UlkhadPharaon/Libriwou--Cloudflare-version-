# Libriwouô — Reconstruction du Projet (Facts Vérifiés)

## Architecture Logicielle

```
SaaS/Libriwouô v1.5/
├── package.json          # React 19, Firebase 12, Tailwind v4, Vite 6, OpenRouter
├── wrangler.json         # Cloudflare Workers config (assets + KV)
├── vite.config.ts        # VitePWA, Tailwind, react plugin
├── tsconfig.json         # TypeScript strict mode
├── server.ts             # Express dev server + Cloudflare bridge
├── src/
│   ├── App.tsx           # 22 routes, ProtectedRoute guard, page animations
│   ├── firebase.ts       # Firebase init, beta login helper, Firestore local cache
│   ├── index.css         # CSS variables for dark/luxury theme system
│   ├── main.tsx          # Entry point
│   ├── worker.ts         # Cloudflare Worker entry point (handles assets)
│   ├── layouts/
│   │   └── DashboardLayout.tsx   # Sidebar nav + topbar
│   ├── contexts/
│   │   ├── AuthContext.tsx    # onAuthStateChanged, hasProfile check (Firestore → localDb)
│   │   └── ThemeContext.tsx   # Dark/Light toggle via CSS vars
│   ├── components/
│   │   ├── BugReporter.tsx       # Submit bug reports to Firestore
│   │   ├── ErrorReporter.tsx     # Error boundary + Sentry-style reporting
│   │   ├── LanguageSwitcher.tsx  # FR/EN toggle using i18next
│   │   ├── NeoLogo.tsx           # SVG logo component
│   │   ├── SplashScreen.tsx      # Loading animation
│   │   ├── Tooltip.tsx           # Accessible tooltip wrapper
│   │   └── OnboardingChecklist.tsx  # Multi-step company profile wizard
│   ├── hooks/
│   │   ├── useLocalCollection.ts    # Subscribe to IndexedDB collection
│   │   └── useTaxNotifications.ts   # Calendar deadline alerts
│   ├── lib/
│   │   ├── tax-rules.ts       # CME/RSI/RNI tax calculation engine (+ payroll CNSS/IUTS)
│   │   ├── tax-rules.test.ts  # Tests ONLY for determineTaxRegime and calculatePayroll
│   │   ├── firebaseUtils.ts   # Firestore error handling helper
│   │   ├── utils.ts           # cn() tailwind merge utility
│   │   ├── docx-generator.ts  # Generate .docx invoices client-side (docx library)
│   │   ├── file-extractor.ts  # PDF/text extraction (mammoth + pdfjs-dist)
│   │   └── betaConfig.ts      # Beta email/password constants (hardcoded)
│   ├── services/
│   │   ├── localDb.ts   # IndexedDB wrapper, PBKDF2+AES-GCM encryption, cloud backup sync
│   │   ├── nim.ts       # AI chat orchestration: tools, propose_transaction, sendChatMessage
│   │   └── intelligence.ts  # fetchDailyIntelligence (client-side Gemini calls)
│   ├── i18n/
│   │   ├── index.ts     # i18next setup with FR/EN
│   │   └── locales/fr.json / en.json   # All translation strings
│   └── pages/ (22 total)
│       ├── LandingPage.tsx              # Marketing page, pricing tiers, FAQ (600 lines)
│       ├── OnboardingPage.tsx           # Company profile wizard
│       ├── DashboardPage.tsx            # Bento grid, charts, deadlines, intelligence feed
│       ├── HubPage.tsx                  # AI chat interface (NEO)
│       ├── DocumentsPage.tsx            # File organization
│       ├── ExpensesPage.tsx             # Expense list CRUD
│       ├── InvoicePage.tsx              # Invoice creation/generation
│       ├── JournalPage.tsx              # Full transaction journal
│       ├── CashflowPage.tsx             # Cash flow analysis
│       ├── BankPage.tsx                 # Bank statement import (UI only — no aggregator)
│       ├── SimulatorPage.tsx            # Tax simulator tool
│       ├── ScanPage.tsx                 # Receipt camera/upload OCR
│       ├── PayrollPage.tsx              # Employee management
│       ├── PayrollSlipPage.tsx          # Payslip generation
│       ├── InventoryPage.tsx            # Stock tracking
│       ├── DeclarationsPage.tsx         # e-SINTAX export preparation
│       ├── FinancialStatementsPage.tsx  # Balance sheet, P&L views
│       ├── BilanPage.tsx                # Financial summary
│       ├── SettingsPage.tsx             # User/settings config
│       ├── VaultPage.tsx                # Encrypted vault UI
│       ├── AgentSkillsPage.tsx          # Custom agent skill definitions
│       ├── ReferencesPage.tsx           # Reference data management
│       ├── AdminHubPage.tsx             # Admin dashboard
│       └── CalendarPage.tsx             # Fiscal calendar & deadlines
├── functions/api/        # Cloudflare Worker handlers
│   ├── chat.ts           # POST /api/chat — LLM chat completions (OpenRouter)
│   ├── vision.ts         # POST /api/vision — Document OCR (Gemini/Grounding)
│   ├── intelligence.ts   # POST /api/intelligence — Daily news scraping
│   └── reference.ts      # POST /api/reference — Reference lookups
├── dist/                 # Build output (prod deployment target)
│   ├── index.html
│   ├── server.cjs        # Express build
│   ├── sw.js             # Service worker
│   └── assets/           # JS/CSS bundles
├── docs/                 # Documentation
│   ├── 01_PROJECT_BIBLE.md     # Architectural guide (French)
│   ├── DATA_SOVEREIGNTY_POLICY.md
│   ├── DATA_SOVEREIGNTY_AUDIT.md
│   ├── pages/02_HUB_IA.md
│   ├── pages/03_DASHBOARD_AND_CASHFLOW.md
│   └── services/04_TAXES_SERVICES.md
└── .claude/agents/       # Claude Code agent personas (22 agents defined)
```

---

## Routes & Protection

| Route | Public? | Auth Required? | Profile Required? | Page Component |
|-------|---------|----------------|-------------------|----------------|
| `/` | ✅ | ❌ | ❌ | LandingPage |
| `/onboarding` | ✅* | ✅ | ❌ (redirected here) | OnboardingPage |
| `/dashboard` | ❌ | ✅ | ✅ | DashboardPage |
| `/expenses` | ❌ | ✅ | ✅ | ExpensesPage |
| `/inventory` | ❌ | ✅ | ✅ | InventoryPage |
| `/payroll` | ❌ | ✅ | ✅ | PayrollPage |
| `/payroll-slip` | ❌ | ✅ | ✅ | PayrollSlipPage |
| `/hub` | ❌ | ✅ | ✅ | HubPage |
| `/documents` | ❌ | ✅ | ✅ | DocumentsPage |
| `/references` | ❌ | ✅ | ✅ | ReferencesPage |
| `/agent-skills` | ❌ | ✅ | ✅ | AgentSkillsPage |
| `/calendar` | ❌ | ✅ | ✅ | CalendarPage |
| `/bank` | ❌ | ✅ | ✅ | BankPage |
| `/simulator` | ❌ | ✅ | ✅ | SimulatorPage |
| `/settings` | ❌ | ✅ | ✅ | SettingsPage |
| `/scan` | ❌ | ✅ | ✅ | ScanPage |
| `/invoices` | ❌ | ✅ | ✅ | InvoicePage |
| `/cashflow` | ❌ | ✅ | ✅ | CashflowPage |
| `/vault` | ❌ | ✅ | ✅ | VaultPage |
| `/journal` | ❌ | ✅ | ✅ | JournalPage |
| `/declarations` | ❌ | ✅ | ✅ | DeclarationsPage |
| `/financial-statements` | ❌ | ✅ | ✅ | FinancialStatementsPage |
| `/bilan` | ❌ | ✅ | ✅ | BilanPage |
| `/admin-hub` | ❌ | ✅ | ✅ | AdminHubPage |

\* Onboarding redirects unauthenticated users to `/`

**ProtectedRoute logic (App.tsx):**
- If not authenticated → redirect to `/`
- If authenticated but `hasProfile === false` → redirect to `/onboarding`
- If authenticated and `hasProfile === true` but visiting `/onboarding` → redirect to `/dashboard`

---

## Base de Données (Firestore Collections)

| Collection | Purpose | Key Fields | Notes |
|-----------|---------|------------|-------|
| `companies/{uid}` | Company profile | companyName, ifu, rccm, taxRegime, sector, estimatedRevenue | One per user UID; created in onboarding or seeded for beta |
| `transactions/{id}` | Financial entries | type (INCOME/EXPENSE/PAYROLL), amountExclTax, vatAmount, date, category, syscohadaCode | Filtered by userId; subscribed via localDb for offline-first |
| `conversations/{id}` | Chat history | userId, messages[], createdAt | Used by HubPage AI chat |
| `intelligence_feed/{id}` | Daily AI news | title, excerpt, category, date, targetSectors[] | Client-side write; cached in localStorage as fallback |
| `encrypted_fiscal_vaults/{uid}` | Zero-knowledge backups | userId, ciphertext (Base64 AES-GCM), updatedAt | Upload/restore via VaultPage |

---

## Intelligence Artificielle

**Models:** Default = `inclusionai/ling-3.0-flash-vl:free` (via OpenRouter free tier). Configurable via env `OPENROUTER_CHAT_MODEL`.

**API Endpoints (functions/api/):**
- `POST /api/chat` — General conversational AI with function calling
- `POST /api/vision` — Document OCR (receipt scanning, SYSCOHADA code assignment)
- `POST /api/intelligence` — Daily market/fiscal news aggregation
- `POST /api/reference` — Fiscal law reference queries

**Tools defined in `src/services/nim.ts`:**
1. `propose_transaction` — Create a financial transaction from OCR/conversation
2. `update_company_profile` — Modify company settings
3. `delete_transaction` — Remove a transaction
4. `generate_invoice` — Pre-fill invoice form
5. `generate_payroll_slip` — Calculate and display payslip
6. `fetch_all_transactions` — Retrieve full transaction history
7. `fetch_all_invoices` — List issued invoices
8. `fetch_inventory_items` — Get stock levels
9. `fetch_employee_list` — Get employees
10. `check_duplicates` — Detect duplicate transactions
11. `fetch_fiscal_calendar` — Get upcoming deadlines
12. `simulate_scenario` — Run what-if tax simulations

**Reasoning Loop:** `sendChatMessage` supports up to 3 iterations of tool calling before returning. 45-second timeout per iteration.

---

## Calculs Fiscaux (Moteur Core)

**Régimes fiscaux Burkina Faso / UEMOA:**

| Régime | Seuil CA | Taux TVA | Taux IS | Notes |
|--------|----------|----------|---------|-------|
| CME | < 15M FCFA | Remplacée par CME (2% biens / 5% services) | Non applicable | Micro-entreprise |
| RSI | 15M–50M FCFA | 18% | 27.5% (MFP min: 300K FCFA) | Régime simplifié |
| RNI | > 50M FCFA | 18% | 27.5% (MFP min: 1M FCFA) | Régime réel normal |

**Calculs Salariaux:**
- CNSS Employé: 5.5% brut
- CNSS Employeur: 16% + 3.5% prestations familiales = 19.5% brut
- IUTS: Barème progressif (12.1% à 25%) sur base nette de CNSS

**Fichier unique de vérité :** `src/lib/tax-rules.ts` — fonctions `calculateTaxes()`, `determineTaxRegime()`, `calculatePayroll()`. Un seul fichier de test existe (`tax-rules.test.ts`).

---

## Stockage Local & Sécurité

**IndexedDB (libriwouoLocalDB, version 2):** 13 collections persistées. Fallback automatique à localStorage si IDB unavailable.

**Encryption:** PBKDF2 (80K iterations, SHA-256) → AES-GCM-256. Passphrase dérivée localement. ZK pour cloud backups vers Firestore `encrypted_fiscal_vaults`.

**Persistence:** `navigator.storage.persist()` appelé au démarrage pour demander la persistance haute capacité (jusqu'à 80% espace disque appareil).

---

## Déploiement & Infrastructure

- **Dev local:** `npm run dev` → `tsx server.ts` (Express + Vite middleware, port 3000)
- **Build prod:** `npm run build` → `vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`
- **Deploy cible:** Cloudflare Pages (wrangler.json + assets directory `dist`) ou Vercel
- **PWA:** `vite-plugin-pwa` avec manifest, auto-update service worker, icons
