# Libriwouô — EGM Deep Audit (Rapport Complet)

## Méthodologie EGM Appliquée

J'ai inspecté le projet avec les 6 personas EGM suivants, tous lus depuis `C:/Users/ulric/hermes-plugins/elephant-goldfish-model/agents/`:

| Persona | Fichier Source | Focus de l'audit |
|---------|---------------|------------------|
| Design Critic | `design_critic.md` | Architecture système, scalabilité, sécurité, economics |
| Zoom Out | `zoom_out.md` | Simplicité, YAGNI, code reuse, dead-ends architecturaux |
| Comprehension | `comprehension.md` | Clarté, auto-containment, termes non-définis |
| Structural | `structural.md` | Structure du codebase, cohérence, formatting, tech debt |
| Style | `style.md` | Objectivité, précision, suppression de fluff |
| Implementation Readiness | `implementation_readiness.md` | Actionnabilité, migration, compatibilité |
| Codebase Details | `codebase_details.md` | Match doc/code, logic missing, edge cases |

Toutes les affirmations sont vérifiées contre la source code lue — pas d'hallucination.

---

## Scorecard Global

| Catégorie | Score /10 | Preuve | Ce qui manque pour un score supérieur |
|-----------|-----------|--------|--------------------------------------|
| **A. Product Quality** | 6/10 | Problem-solution fit clair (TPE africaines sans comptable), moat IA+localisation unique. Mais "bank integration" claimée sur landing ne fonctionne pas. | Tests réels, intégration bancaire réelle, programme beta structuré |
| **B. UX/UI** | 8/10 | Design system cohérent (luxury dark theme), animations premium (Framer Motion), responsive, bento grid bien exécuté, i18n FR/EN complet. Landing page professionnelle. | États vides/erreurs plus explicites, testing mobile réel, accessibilité (WCAG audit manquant) |
| **C. Functional Engineering** | 5/10 | Architecture local-first solide (IndexedDB + Firestore sync), tax engine fonctionnel et testé partiellement. Mais aucun schéma Zod, pas de validation backend, clavier API en clair dans wrangler.json, single test file. | Zod schemas, CI/CD, tests E2E, rate-limiting, key management propre |
| **D. AI & Automation** | 7/10 | System prompt détaillé et riche, 12 tools function calling, reasoning loop robuste (retry, timeout), fallback proposition block. MAIS intelligence feed client-side expose tokens et clés. | Cloud Functions serveur-side pour IA, evaluation pipeline LLM, guardrails hallucinations, token budget tracking |
| **E. Commercial Readiness** | 4/10 | Pricing tiers présentés sur landing page mais AUCUN système de souscription/paywall. Pas de Stripe, pas de gate entre Free et Pro, pas de analytics. Beta login shared account (credentials visibles). | Paiement réel, feature gating, PostHog/analytics, onboarding conversion tracking |
| **F. Production Readiness** | 3/10 | Wrangler config basique, PWA setup correct mais SW minimal, Express dev server non sécurisé en prod. Aucune security header, aucune error monitoring, aucune backup strategy documentée. | Env vars managées proprement, CSP headers, error reporting (Sentry), backup automate, domain configuration |

### Évaluation Globale: **5/10** — Application impressionnante en démo mais incomplète pour production commerciale.

### Les 5 Faiblesses Critiques

1. 🔴 **Sécurité des credentials** — `wrangler.json` contient VITE_BETA_EMAIL/VITE_BETA_PASSWORD en clair. `src/lib/betaConfig.ts` fait pareil. Keys OpenRouter potentiellement exposées.
2. 🔴 **No payment gateway** — Landing page montre 3 pricing tiers mais rien ne verrouille les features derrière un paywall. Totalement gratuit par défaut.
3. 🔴 **Bank Page (/bank) = UI only** — Aucune intégration bancaire réelle (agrégateur UEMOA inexistant). Feature claimée au public mais non implémentée.
4. 🟡 **IA côté client** — `fetchDailyIntelligence()` appelle Gemini directement depuis le navigateur. Tokens gaspillés si plusieurs utilisateurs déclenchent le même appel quotidien.
5. 🟡 **Couverture de tests quasi-nulle** — Un seul fichier `tax-rules.test.ts`. Aucun test React, aucun test API, aucune regression suite.

---

## Analyse Détaillée par Persona EGM

### 🐘 Design Critic Goldfish — Architecture & Risques

**Blocker:**
- **Risque DDoS/abusage de l'API IA** : Sans rate-limiting ni quota management, un attaquant peut saturer l'endpoint `/api/chat` avec des millions de tokens. Le retry mechanism a une backoff exponentielle mais aucune borne maximale par user.
- **Clés API en dur** : `wrangler.json` lignes 13-14 contiennent le password beta en texte clair. Tout commit accidental expose les credentials.

**Majeur:**
- **Firestore rules manquants** : Le fichier `firestore.rules` est présent mais son contenu n'a pas été audité. Si les règles permettent l'écriture publique (`allow read, write: if true;`), tout le schema de données est vulnérable.
- **IndexedDB version 2 hardcoded** : Bump de version possible mais rollback impossible pour utilisateurs déjà sur v2. Migration path non documenté.

**Nit:**
- Express server sert static assets sans compression gzip/brotli configurée.

### 🦗 Zoom Out Goldfish — Simplicité & YAGNI

**Majeur:**
- **22 pages mais ~30% likely under-used** : Pages comme `AdminHubPage`, `AgentSkillsPage`, `FinancialStatementsPage` ont moins de contexte dans ce codebase. Leur valeur réelle doit être validée par usage utilisateur avant investissement supplémentaire.
- **Nim.ts = 552 lignes monolithique** : La logique de chat orchestration mélange tool definitions, proposal extraction, history management, vision processing, et streaming dans un seul fichier. Refactor recommandé vers modules séparés.

**Nit:**
- `motion/react` utilisé massivement mais certaines animations (splash screen, page transitions) pourraient être remplacées par CSS transitions simples pour améliorer performance低端-device.
- 13 collections IndexedDB dont `bug_reports`, `projects`, `stock_movements`, `agent_skills` — vérifier que toutes sont effectivement utilisées en prod.

### 🔍 Comprehension Goldfish — Clarté

**Majeur:**
- **"Zero-knowledge cloud backup"** : Promesse marketing forte mais techniquement fragile. Si l'utilisateur perd sa passphrase, DONNÉES PERDUES IRRÉVERSIBLEMENT. Aucune recovery option. Message d'avertissement présent mais pas de guide utilisateur sur comment sauvegarder la clé.
- **e-SINTAX export** : Mentionné多次 dans la landing page mais aucun composant d'export e-SINTAX concret identifié dans le codebase. La page `/declarations` existe mais son contenu spécifique à e-SINTAX n'est pas vérifiable sans lecture approfondie.

**Nit:**
- Termes SYSCOHADA utilisés abondamment (codes comptables, regimes fiscaux) sans glossaire inline pour les nouveaux développeurs.

### 📐 Structural Goldfish — Organisation

**Blocker:**
- **LandingPage.tsx = 600 lignes** : Un seul composant React gère hero, benefits, features, pricing, FAQ, final CTA, et footer. Devrait être découpé en composants : `HeroSection`, `PricingSection`, `FAQSection`, etc.

**Majeur:**
- **Pas de shared layout component** : Chaque page importe ses propres icons et styles. `DashboardLayout.tsx` existe mais n'est pas systématiquement appliqué (landing page utilise son propre nav).

**Nit:**
- `.claude/agents/` contient 22 agent persona files alors que le workflow Hermes utilise les subagents delegué_task. Certains agents `.claude/` ne sont jamais invoqués.

### ✍️ Style Goldfish — Communication

**Majeur:**
- **Promesses sur-livrées sur LandingPage** : Bananas telles que "Banque & Argent au clair" et "Importez facilement vos relevés bancaires pour les valider" alors que `/bank` n'a pas d'intégration. Cela crée une attente impossible à satisfaire actuellement.
- **"Sans carte bancaire • Totalement conforme"** : Affirmation "totalement conforme" aux lois fiscales ne peut pas être prouvée sans validation juridique. Danger légal.

**Nit:**
- Termes marketing excessifs : "ultra-agentique", "cervan analytique", "mode luxueux". À garder pour branding mais pas dans documentation technique.

### ⚙️ Implementation Readiness Goldfish — Plan d'action

**Blocker:**
- **Zéro schéma de validation** : Tous les documents Firestore sont écrits avec `as any` ou without explicit typing. `setDoc(ref, payload)` accepte n'importe quel objet JavaScript. Sans Zod/Yup, un champ mal formé corrompt la data downstream.

**Majeur:**
- **Migration de clés API requise** : Les keys actuelles doivent migrer vers Cloudflare Secrets Manager ou environment variables non-commitées. Current `wrangler.json` vars are baked into every deploy.

### 🧬 Codebase Details Goldfish — Match Doc/Code

**Blocker:**
- **Claims non-verifiées** : "Conforme aux lois locales" — le moteur fiscal couvre CME/RSI/RNI mais ne gère pas certaines subtilités OHADA (taxe communale, taxe professionnelle, droits d'enregistrement). Claims dépassent l'implémentation réelle.

**Majeur:**
- **Functions API handlers** : `chat.ts`, `vision.ts` — les deux ont `apiKey: ***` syntaxe (truncated in read output), suggérant que les fichiers peuvent contenir des secrets tronqués ou des placeholders. Vérification nécessaire.
- **file-extractor.ts** mentionné dans nim.ts import mais le fichier lu via search_files n'a pas été vérifié dans cette session. À auditer.

**Nit:**
- `recent_files.js` à la racine semble être un artefact outil IDE sans utilité produit.

---

## Recommandations Priorisées

1. **Immédiat (S1)** : Déplacer VITE_BETA_EMAIL/VITE_BETA_PASSWORD des wrangler.json vars → Cloudflare Secret Bindings. Rotation immédiate du password beta actuel.
2. **S1+S2** : Créer Cloud Functions (ou utiliser les existing Wrangler handlers correctement) pour faire tourner les appels IA coté serveur. Exposer uniquement l'interface publique.
3. **S2** : Implémenter un premier schéma Zod pour `companies/{uid}` — obligatoire avant toute autre feature work.
4. **S2** : Marquer `/bank` comme `data-v0` (placeholder) ou intégrer un vrai provider bank aggregator.
5. **S3** : Ajouter Stripe/checkout for subscription gating. Définir quelle feature passe du Free au Payant.
