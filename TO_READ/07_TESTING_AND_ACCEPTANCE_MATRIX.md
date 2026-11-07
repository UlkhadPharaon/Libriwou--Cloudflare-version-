# Libraiwouô — Matrice de Tests & Acceptation

## Tests Fonctionnels

| ID | Description | Zone Testée | Résultat Attendu | Statut |
|----|-------------|-------------|------------------|--------|
| F-01 | Utilisateur non-auth → LandingPage chargée sans redirect | `/` (routes root) | Page s'affiche, bouton Google visible | À faire |
| F-02 | Login Google → redirection vers onboarding si no-profile | `/onboarding` après auth | Formulaire wizard affiche, étape 1 visible | À faire |
| F-03 | Completion onboarding → redirection dashboard | `/dashboard` post-onboarding | Bento grid charge, noms société visible | À faire |
| F-04 | Scan receipt photo → OCR → propose_transaction popup | `/scan` → Hub IA | Popup apparaît avec montants extraits, bouton "Validate" | À faire |
| F-05 | Validate transaction dans popup → apparaît dans Dashboard/Expenses | `DashboardPage.tsx` + `ExpensesPage.tsx` | Transaction visible avec bon montant/date/catégorie | À faire |
| F-06 | Chat Hub IA — question fiscale basique répondue correctement | `HubPage.tsx` | Réponse professionnelle en français avec chiffres précis | À faire |
| F-07 | Génération facture PDF client-side | `InvoicePage.tsx` → docx-generator | Fichier .docx téléchargé, contenu conforme SYSCOHADA | À faire |
| F-08 | Calcul tax CME correct pour revenue < 15M FCFA services | `tax-rules.ts` | cmeAmount = revenue * 0.05, isAmount = 0, tvaAmount = 0 | Fait (test existant partiel) |
| F-09 | Calcul RSI avec MFP floor | `tax-rules.ts` | isAmount = max(calculé, MFP prorata) quand profit * 0.275 < MFP | À faire |
| F-10 | Export JSON sauvegarde locale → import fonctionne | `VaultPage.tsx` / `localDb.ts` | Données restaurées identiques à l'export initial | À faire |

## Tests de Regression

| ID | Description | Pourquoi Critique |
|----|-------------|-------------------|
| R-01 | Tax engine: modifier revenue ne casse pas determineTaxRegime | Cœur du produit — bug ici = fausses déclarations fiscales |
| R-02 | IndexedDB persist sur page reload | Les données doivent survivre au refresh |
| R-03 | Subscription gate: sans payement, features Pro verrouillées | Règle business fondamentale |
| R-04 | Encryption/decryption ZK: passphrase correcte restore data | Si échec, utilisateur perd données irréversiblement |

## Tests UI / Responsive

| ID | Description | Résultat Attendu |
|----|-------------|------------------|
| U-01 | LandingPage mobile (360px width) | Hero + pricing lisibles, pas de overflow horizontal |
| U-02 | Dashboard tablet (768px) | Bento grid responsive, pas de texte coupé |
| U-03 | Hub AI chat messages overflow long content | Messages wrap correctement, pas de overflow caché |
| U-04 | Dark/Light theme toggle cohérent | Toutes les surfaces changent de couleur uniformément |
| U-05 | i18n FR ↔ EN switch instantané | Tous les labels changent sans recharger page |

## Tests d'Accessibilité

| ID | Description | Résultat Attendu |
|----|-------------|------------------|
| A-01 | Navigation clavier (Tab/Enter/Esc) | Focus visible sur chaque élément interactif, Esc ferme modals |
| A-02 | Contrast ratio textes ≥ 4.5:1 WCAG AA | Aucun texte blanc sur fond noir/luxury-950 en dessous du ratio |
| A-03 | aria-label sur icônes boutons | `<button>` avec icône seule a un `aria-label` descriptif |
| A-04 | Screen reader basic test | VoiceOver/Narrator lit la landing page séquentiellement dans l'ordre correct |

## Tests Sécurité

| ID | Description | Résultat Attendu |
|----|-------------|------------------|
| S-01 | Firestore rules: user A ne peut pas lire docs user B | Test via Firebase Rules Simulator |
| S-02 | No API keys exposed in frontend bundle | Audit `dist/assets/*.js` pour strings contenant "sk-" ou clés OpenRouter |
| S-03 | Beta login credentials pas en clair dans git | `git log -p --all -- "*.json"` ne montre pas password |
| S-04 | CSP headers sur production deploy | Headers response incluent Content-Security-Policy restrictive |
| S-05 | Input sanitization: messages chat hostiles gérés | Texte HTML brut injecté dans chat n'est pas exécuté |

## Tests de Performance

| ID | Description | Métrique |
|----|-------------|----------|
| P-01 | LCP (Largest Contentful Paint) LandingPage < 2.5s | Chrome DevTools Performance tab, 4G simulation |
| P-02 | First Input Delay < 100ms | Interaction rapide après load initial |
| P-03 | Bundle size total < 2MB gzipped | `npm run build` output dist/ stats |
| P-04 | IndexedDB init < 500ms sur cold start | Console timing autour de `initIndexedDB()` |

## Smoke Tests Pré-Déploiement

| ID | Action | Vérification |
|----|--------|-------------|
| SM-01 | `npm run build` | Exit code 0, aucun warning critique |
| SM-02 | `npm run lint` (= tsc --noEmit) | 0 errors TypeScript |
| SM-03 | Server démarre (`tsx server.ts`) | Console affiche "Server running on http://localhost:3000" |
| SM-04 | Naviguer vers localhost:3000 en local dev | Page charge sans erreur console |
| SM-05 | Build Cloudflare Workers (`wrangler deploy --dry-run`) | Pas d'erreurs de compilation Worker |
| SM-06 | PWA manifest.json valide | Validé via Lighthouse PWA audit |
