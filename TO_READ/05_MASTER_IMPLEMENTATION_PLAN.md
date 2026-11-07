# Libriwouô — Plan Maitre d'Implementation

## Objectif Cible

Transformers Libriwouô d'un prototype de démonstration en un produit commercial déployable avec :
- Infrastructure sécurisée (keys protégées, IA serveur-side, rate-limiting)
- Authentification robuste + système de souscription fonctionnel
- Intégration bancaire réelle ou mise à jour explicite du statut "coming soon"
- Pipeline CI/CD + tests automatisés
- Page de conversion optimisée et page de marque professionnelle

---

## PHASE 1 — Fondations & Sécurité (Priorité Blocker)

### Tâche 1.1 : Rotation des credentials beta + déplacement vers Cloudflare Secrets
**Fichier(s) affecté(s):** `wrangler.json`, `src/lib/betaConfig.ts`, `src/firebase.ts`
**Problème :** VITE_BETA_EMAIL/VITE_BETA_PASSWORD en clair dans wrangler.json vars line 13-14; betaConfig.ts has hardcoded email/password.
**Solution :**
1. Dans Cloudflare Dashboard → Workers → Settings → Variables, ajouter `BETA_EMAIL` et `BETA_PASSWORD` comme secrets.
2. Supprimer ces vars de `wrangler.json` section `vars`.
3. Dans `src/lib/betaConfig.ts`, remplacer les valeurs hardcoded par `import.meta.env.VITE_BETA_EMAIL` et `VITE_BETA_PASSWORD`.
4. Dans `wrangler.json`, lier les secrets via `[vars]` removed → utiliser binding `secrets` section.
5. Changer le password actuel dans Firebase Authentication → Users → Edit user for `beta@libriwouo.bf`.
6. Vérifier qu'aucun autre agent Claude/Codex n'a commité ces keys.

**Critères d'acceptation :**
- [ ] `wrangler.json` ne contient plus ni email ni password en texte brut
- [ ] Le fichier `.env.example` reflète correctement les nouvelles variables
- [ ] Un test complet de login beta fonctionne après déploiement staging
- [ ] Git log vérifié: aucun ancien commit ne contient les old credentials (ou rotate si trouvé)

### Tâche 1.2 : Configuration Firestore Security Rules
**Fichier(s) affecté(s):** `firestore.rules`, `DRAFT_firestore.rules`
**Problème :** Contenu des règles non audité dans cette session. Risque d'accès public si règle trop permissive.
**Solution :**
1. Lire `firestore.rules` et valider chaque ligne.
2. Si règle contient `allow read, write: if true;` pour n'importe quelle collection → la restreindre à `request.auth != null` et filtre par uid.
3. Pour `encrypted_fiscal_vaults/{uid}` → `allow read, write: if request.auth != null && request.auth.uid == uid;`
4. Tester les rules via Firebase Console → Firestore → Rules → Test Simulator.

**Critères d'acceptation :**
- [ ] Chaque collection a une règle qui vérifie `request.auth != null`
- [ ] Aucun write permet d'écrire sur un document d'un autre uid
- [ ] Test Simulator confirme restriction cross-uid

### Tâche 1.3 : Server-side IA — Déplacer intelligence feed vers Cloudflare Worker handler
**Fichier(s) affecté(s):** `functions/api/intelligence.ts`, `src/services/intelligence.ts`
**Problème :** `fetchDailyIntelligence()` côté client appelle directement `/api/intelligence` puis Gemini/OpenRouter. Expose tokens API aux clients, inefficace (chaque utilisateur peut déclencher le même appel quotidien).
**Solution :**
1. Garantis que `functions/api/intelligence.ts` est l'unique point d'entrée pour le scraping intelligence.
2. Ajouter un cache KV (Cloudflare KV namespace) pour stocker les résultats journaliers avec clé `intel:{date}:{sector}` TTL 24h.
3. Modifier `src/services/intelligence.ts` : appeler `/api/intelligence` mais le handler retourne cached data si dispo — jamais de call direct Gemini depuis le navigateur.
4. Retirer toute référence directe à `OPENROUTER_API_KEY` du bundle frontend (vérifier vite.config.ts define block).

**Critères d'acceptation :**
- [ ] L'appel Gemini se fait UNIQUEMENT dans le Worker handler (jamais dans le code bundle React)
- [ ] Cache KV implémenté avec TTL 24h
- [ ] `package-lock.json` montre que `@google/genai` n'est importé QUE dans server-side code (pas dans vendor bundle frontend)

---

## PHASE 2 — Validation Données & Schémas

### Tâche 2.1 : Installations Zod + schémas Firestore
**Fichier(s) affecté(s):** `package.json`, `src/lib/tax-rules.ts`, tous les fichiers qui font `setDoc` / `addDoc` à Firestore
**Problème :** Zéro validation de données entrantes/sortantes. Tout passe avec `as any`.
**Solution :**
1. `npm install zod` 
2. Créer `src/lib/schemas.ts` avec Zod schemas pour :
   - `CompanyProfile` = shape de `companies/{uid}` (companyName, ifu, rccm, taxRegime CME/RSI/RNI, sector, estimatedRevenue, notificationSettings)
   - `Transaction` = shape de `transactions/{id}` (type INCOME/EXPENSE/PAYROLL, amountExclTax, vatAmount, date YYYY-MM-DD, category, syscohadaCode, fecValid boolean)
   - `IntelligenceNews` = shape déjà défini mais formalisé en Zod
3. Utiliser `schema.parse(data)` avant chaque `setDoc` / `addDoc` dans firebase.ts, localDb.ts, et toutes les pages CRUD.
4. Garder fallback existant (silently reject invalid data, log warning) pas crash brutal.

**Critères d'acceptation :**
- [ ] `npm run build` compile sans erreurs avec les nouveaux imports Zod
- [ ] Tentative de save d'un objet CompanyProfile manquant `companyName` échoue avec erreur Zod visible dans console
- [ ] Migration rétrocompatible : documents existants sans tous les champs sont accepts (Zod `.partial()` ou `.catch()`)

### Tâche 2.2 : Tests unitaires supplémentaires — Engine fiscal
**Fichier(s) affecté(s):** `src/lib/tax-rules.test.ts`
**Problème :** Un seul fichier de test existe. Couverure ≈ < 5% du codebase total.
**Solution :**
1. Étendre `tax-rules.test.ts` avec tests pour :
   - `calculateTaxes()` — couvrir CME services, CME goods, RSI, RNI, revenue=0, monthsActive variations
   - `calculatePayroll()` — salaires bas/moyen/haut bracket IUTS, grossSalary=0
   - Edge cases : revenue négatif, expenses > revenue, monthsActive=1, grossPayroll=0
2. Ajouter `vitest` ou garder Jest/TSC-based tests selon existing setup.
3. Objectif coverage ≥ 80% pour `tax-rules.ts` seulement (c'est le coeur critique).

**Critères d'acceptation :**
- [ ] `npm run lint` (= tsc --noEmit) passe
- [ ] Tous les nouveaux tests passent (`tsc --noEmit` + vitest run si configuré)
- [ ] Coverage report ≥ 80% pour `tax-rules.ts`

---

## PHASE 3 — Monétisation & Conversion

### Tâche 3.1 : Intégration Stripe Checkout — Feature gating
**Fichier(s) affecté(s):** `package.json`, `src/App.tsx`, `src/pages/LandingPage.tsx`, `src/contexts/AuthContext.tsx`, Firestore `companies/{uid}` schema
**Problème :** Landing page affiche 3 pricing tiers mais aucun bouton ne mène à un paiement réel. Toute feature accessible gratuitement.
**Solution :**
1. `npm install stripe @stripe/stripe-js`
2. Créer Cloudflare Worker route `POST /api/create-checkout-session` qui appelle Stripe API avec price_id correspondant au plan choisi.
3. Hook webhook Stripe → Cloudflare Worker → update Firestore `companies/{uid}.subscription.plan` et `subscription.expiresAt`.
4. Modifier `ProtectedRoute` dans App.tsx : vérifier `hasProfile` ET `subscription.status === 'active'` (ou free trial période).
5. Définir quel feature est "free" vs "pro" :
   - **Free** (gratuit permanent) : Dashboard, Scan (max 10 reçus/mois), Hub AI (messages limités), Simulateur
   - **Pro** (démarrer après 7 jours free trial) : Transactions illimitées, Invoices PDF, Export, Payroll, Bank aggregation
6. Afficher un badge "PRO" sur features verrouillées avec CTA "Upgrade to Pro — 25 000 FCFA/mois".

**Critères d'acceptation :**
- [ ] Click "Start Free Trial" sur landing → redirige vers Stripe Checkout hosted page → après payment → redirect back to dashboard
- [ ] User without active subscription voit badges PRO sur features avancées + bouton upgrade
- [ ] Webhook Stripe met à jour Firestore subscription status
- [ ] Feature gate testé : accès bloqué si subscription inactive, débloqué après payment réussi

### Tâche 3.2 : Waitlist email capture (prérequis Stripe production)
**Fichier(s) affecté(s):** `src/pages/LandingPage.tsx`
**Solution temporaire :** Avant Stripe actif, remplacer les boutons "Start Free Trial" par un formulaire email simple qui écrit dans Firestore collection `waitlist/{email}` + email confirmation via SendGrid/Resend.

---

## PHASE 4 — Bank Integration & Feature Realization

### Tâche 4.1 : Marquer /bank comme "Coming Soon" officiellement OU intégrer agrégateur
**Fichier(s) affecté(s):** `src/pages/BankPage.tsx`
**Option A (rapide) :** Remplacer tout contenu interactif par un écran élégant "Bank integration coming Q1 2027" avec explication et email waitlist interne.
**Option B (réelle) :** Intégrer Plaid, Sankore, ou Kippa (aggregateurs bancaires Afrique) — nécessite signature contrat fournisseur, clés API, OAuth flow complexe. Estimé : 3-4 semaines dev.

**Recommandation :** Option A pour Phase 4 immédiate. Option B pour Phase 6+ si traction justifie investissement fournisseur.

---

## PHASE 5 — CI/CD & Déploiement Production

### Tâche 5.1 : Configuration GitHub Actions pipeline
**Fichier(s) affecté(s):** `.github/workflows/ci.yml` (nouveau), `package.json` scripts
**Solution :**
1. Créer `.github/workflows/ci.yml` avec steps :
   - `npm ci` → `npm run lint` (tsc --noEmit) → `npm test` → `npm run build`
   - Bloc deployment conditionnel : only on `main` branch push
2. Ajouter scripts package.json : `"test": "vitest run"` ou équivalent.
3. Configurer Cloudflare Pages deployment via GitHub integration (push to main → auto-deploy).

### Tâche 5.2 : PostHog analytics installation
**Fichier(s) affecté(s):** `package.json`, `src/main.tsx`, `index.html`
**Solution :**
1. `npm install posthog-js`
2. Initialiser PostHog dans `src/main.tsx` avec clef publique (stockée dans env var, pas en dur).
3. Track events : `page_view`, `signup_complete`, `scan_receipt`, `generate_invoice`, `start_trial`, `upgrade_click`.
4. Créer tableau de bord PostHog pour mesurer funnel conversion.

---

## PHASE 6 — UX Polish & Performance

### Tâche 6.1 : Refactor LandingPage
**Fichier(s) affecté(s):** `src/pages/LandingPage.tsx` → split into `LandingPage.tsx` + `sections/HeroSection.tsx`, `FeaturesSection.tsx`, `PricingSection.tsx`, `FAQSection.tsx`, `FinalCTASection.tsx`
**Solution :** Extraire chaque `<section>` en composant autonome ≤ 100 lignes. Importer dans LandingPage qui devient un layout clean.

### Tâche 6.2 : Mobile performance audit
**Solution :**
1. Auditer LandingPage Chrome DevTools Performance tab → identifier long tasks > 50ms.
2. Optimiser animations Framer Motion pour mobile (réduire staggerChildren, disable motion sur touch devices via `useMediaQuery`).
3. Précharger images critical path (logo, favicon) via `<link rel="preload">` dans index.html head.

---

## Dépendances & Ordre d'Exécution

```
PHASE 1.1 ──→ PHASE 1.2 ──→ PHASE 1.3 (sécurité → validation → backend)
    │
    ├──→ PHASE 2.1 (schémas Zod — parallèle avec 1.3 possible)
    ├──→ PHASE 2.2 (tests fiscaux — parallèle)
    │
    ├──→ PHASE 3.1 (Stripe — dépend 2.1 pour auth gate)
    ├──→ PHASE 4.1 (Bank page — indépendantes)
    │
    ├──→ PHASE 5.1 (CI/CD — dépend build stable de 2.x)
    ├──→ PHASE 5.2 (PostHog — indépendant)
    │
    └──→ PHASE 6.1+6.2 (UX polish — dernier, dépend tout le reste)
```

### Tâches en Parallèle (mêmes executors):
- 1.1 et 1.2 peuvent être faites par deux agents différents (credentials vs firestore rules)
- 2.1 et 2.2 parallèles (schémas vs tests)
- 5.2 parallèle avec tout
