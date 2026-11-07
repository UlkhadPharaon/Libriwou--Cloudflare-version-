# Libriwouô — Stratégie UX/UI & Page de Conversion

## Système de Design Actuel

Le design system est basé sur des **CSS variables racine** dans `src/index.css` :
- Palette "luxury dark" : `luxury-950`, `luxury-900`, `gold-400/500/100` comme accents primaires, `emerald` pour succès/actions secondaires.
- Typography : Serif pour headings (font-serif), Sans-serif pour body. Tracking large sur uppercase labels.
- Layout : Border radius généreux (`rounded-[2.5rem]`), backdrop-blur, gradients subtils.
- Iconographie : `lucide-react` complet, icônes cohérentes par section.

### Forces UX
- Cohérence visuelle forte — tous les composants partagent le même vocabulaire visuel.
- Animations premium via Framer Motion (transitions entre pages).
- Thème responsive fonctionnel (mobile-first sur beaucoup de pages).
- i18n FR/EN bien structuré avec 261+ clés de traduction.

### Points d'Amélioration UX
1. **Accessibilité (WCAG 2.1 AA) non testée** — Contraste texte/fond à vérifier, navigation clavier absente, aria-labels manquants.
2. **États vides insuffisants** — Dashboard montre des données quand l'utilisateur n'a rien enregistré mais pas d'onboarding guidance claire ("commencez par scanner un reçu").
3. **Feedback utilisateur faible** — Aucune toast notification après save/create, aucune confirmation visuelle immédiate.
4. **Breadcrumbs / back navigation** — Absents sur la plupart des pages internes. L'utilisateur se perd facilement.
5. **Performance mobile** — 600 lignes React + animations dans LandingPage peut causer jank sur devices low-end (< 2GB RAM).

---

## Architecture de Pages Proposée

```
Root
├── Public
│   ├── Landing (/)              → Hero, benefits, features, pricing, FAQ, final CTA
│   ├── Auth                      → Google Sign-In, email/password (future)
│   └── Beta Demo Access         → One-click shared demo account
├── Onboarding (post-auth, no-profile)
│   ├── Step 1: Company Info     → Nom, IFU, RCCM, secteur, CA estimé
│   ├── Step 2: Tax Regime       → Auto-déterminé selon CA, confirmable manuellement
│   └── Step 3: Done → Redirect to Dashboard
├── App (authenticated + profiled)
│   ├── Dashboard                 → Bento grid, quick actions, intelligence feed
│   ├── Scan                     → Camera/upload receipt OCR → propose_transaction popup
│   ├── Hub AI                   → Chat conversation with NEO + file attach
│   ├── Expenses                 → List + filter + CRUD + bulk import CSV
│   ├── Invoices                 → Create/edit/list/generate PDF export
│   ├── Journal                  → Full chronological transaction log
│   ├── Cashflow                 → Chart view by month/quarter/year
│   ├── Payroll                  → Employee list + add + edit + generate payslips
│   ├── Inventory                → Stock tracking, movements, alerts
│   ├── Simulator               → Tax what-if scenario calculator
│   ├── Declarations             → e-SINTAX-ready data preparation & export
│   ├── Financial Statements     → Balance sheet, P&L, cash flow statement views
│   ├── Calendar                 → Fiscal deadline calendar with reminders
│   ├── Vault                    → Encrypted backup management
│   ├── Settings                 → Profile, language, notifications, plan management
│   ├── References               → SYSCOHADA code reference catalog
│   ├── Agent Skills             → Custom skill definitions for NEO agent
│   ├── Admin Hub                → (future) multi-admin oversight
│   └── Bank                     → [PLACEHOLDER: "coming soon" or real integration]
└── Error States
    ├── 404                       → Generic not-found with return-to-dashboard
    ├── Network Loss              → Offline banner + queue local operations
    └── Server Error              → Retry + contact info
```

---

## Page de Landing — Structure Optimisée

La LandingPage actuelle (600 lignes monolithique) doit être refactorée en composants séparés tout en conservant sa structure actuelle. Voici chaque section avec son rôle et recommandation copy :

### Section 1 : Hero
- **Headline actuel :** "Votre gestion d'entreprise sans aucune prise de tête."
- **Verdict :** Bon — simple, direct, parle au pain point.
- **Suggestion :** Ajouter un sous-headline chiffré si disponible : "Dédiez 80% moins de temps à votre comptabilité" (si validé par beta users).

### Section 2 : Benefits (3 cards)
- Les 3 benefit cards (Zéro stress administratif / Toujours en règle / Suivi en direct) sont pertinentes.
- **Ajouter une 4ème card :** "IA qui classe vos reçus automatiquement" — c'est le différenciateur technique majeur.

### Section 3 : Features Grid (6 items)
- Liste exhaustive mais overwhelming. Grouper en 3 catégories :
  - **Automatisation** : Scanner photo + IA classification
  - **Conformité** : Règles fiscales locales + e-SINTAX export  
  - **Suivi** : Dashboard temps réel + alertes fiscales
- Réduire de 6 à 6 mais mieux organisées visuellement (pas juste une grid plate).

### Section 4 : Pricing
- Prix en FCFA ✓ (adapté au marché cible)
- **Problème critique :** Aucun bouton "Souscrire" ne mène à un système de paiement. Tous les boutons CTA mènent simplement au signup Google.
- **Fix immédiat :** Remplacer les CTA "Start Free Trial" par un formulaire email waitlist ou un lien Stripe Checkout (quand Stripe sera configuré).
- Ajouter un badge "Premiers 100 utilisateurs : 50% premier mois" pour créer urgence.

### Section 5 : FAQ
- Les 4 FAQs actuelles sont suffisantes mais génériques.
- **Ajouter :** "Est-ce que mes données sont en sécurité ?" (réponse détaillée sur IndexedDB + AES-GCM).
- **Ajouter :** "Fonctionne-t-il sans internet ?" (réponse sur le mode offline/local-first).

### Section 6 : Final CTA
- Bouton unique "Créer mon compte gratuit" — efficace.
- **Ajout recommandé :** Témoignages de beta-testeurs réels (même 2-3 courts). Si aucun beta user existant, retirer temporairement cette section plutôt que de laisser vide.

---

## Principes UX pour Phase 2

1. **Time-to-value < 30 secondes** — Après login, l'utilisateur doit pouvoir scanner un premier reçu ET voir la transaction apparaître dans le dashboard en moins de 30 sec.
2. **Progressive disclosure** — Ne pas montrer toutes les 22 pages dès le départ. Afficher uniquement Dashboard, Scan, Hub, Expenses après onboarding. Les autres (Inventory, Payroll, Bank) reveal progressivement quand l'utilisateur a assez de transactions.
3. **Consistent feedback loop** — Chaque action utilisateur (save, delete, scan complete) produit une notification visible ≤ 5 seconds. Pas d'action silencieuse.
4. **Mobile-first testing** — Toutes les modifications testées sur Chrome DevTools Samsung Galaxy S20 emulation (360x800). L'ICP principal utilise Android.
5. **Zero-friction onboarding** — Le wizard onboarding maximal 4 étapes, auto-filled quand possible. Temps total objectif : < 60 secondes.
