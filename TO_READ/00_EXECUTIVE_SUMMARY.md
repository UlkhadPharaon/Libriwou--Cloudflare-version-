# Libriwouô / NeoCompta AI — Audit Exécutif & Feu de Route

## Produit

**Nom :** Libriwouô (alias interne : NeoCompta AI)  
**Catégorie :** SaaS Comptabilité & Fiscalité pour les TPE/PME africaines (UEMOA, OHADA)  
**Cible :** Entrepreneurs, auto-entrepreneurs, indépendants du Burkina Faso et espace UEMOA qui doivent gérer leur fiscalité SYSCOHADA sans comptable dédié.  
**Stack :** React 19, Vite, Tailwind CSS v4, TypeScript, Firebase Auth + Firestore, IndexedDB (local-first), Cloudflare Workers (wrangler.json). IA via OpenRouter (`@google/genai`, `openai` SDK).  

---

## État Actuel

Libriwouô est une application web complète avec **22+ pages** fonctionnelles couvrant un cycle comptable entier : landing page, onboarding, dashboard bento, hub IA, facturation, dépenses, inventaire, paie, simulateur fiscal, journal comptable, déclarations, bilans, coffre-fort ZK. La logique fiscale SYSCOHADA (CME/RSI/RNI), le calcul salarial CNSS/IUTS, l'OCR par IA, et la sauvegarde chiffrée locale sont implémentés. L'application utilise IndexedDB comme cache local-first avec synchronisation vers Firestore.

---

## Faiblesses Critiques Identifiées

| Priorité | Problème | Impact |
|----------|----------|--------|
| 🔴 Blocker | Clés API exposées dans `wrangler.json` vars (email/mot de passe beta en clair) | Risque sécurité majeur ; credentials en texte brut |
| 🔴 Blocker | Pas d'intégration bancaire réelle (page `/bank` UI-only, pas d'agrégateur UEMOA) | Feature claimée mais non fonctionnelle — faux-plein sur la landing page |
| 🔴 Blocker | Intelligence Feed client-side (fetchDailyIntelligence appelle Gemini depuis le navigateur) | Latence + tokens gaspillés + clé API exposée côté client si déploiement non-Wrangler |
| 🟡 Majeur | Aucun système de paiement/souscription réel ; les "abonnements" sur la landing page ne vérifient rien | Conversion impossible ; aucune gate entre Free et Pro |
| 🟡 Majeur | Tests unitaires limités à un seul fichier `tax-rules.test.ts`; aucune couverture E2E ou de régression | Risc de régression sur le moteur fiscal critique |
| 🟡 Majeur | Zod/injection schemas absents ; validation Firestore manuelle dans chaque composant | Vulnérabilités données + schémas inconsistants |
| 🟢 Mineur | 600 lignes de LandingPage monolithique ; composants peu réutilisables | Maintenance coûteuse |
| 🟢 Mineur | PWA installable mais service worker basique (workbox généré) ; pas de stratégie offline complète | Expérience dégradée hors-ligne malgré claims "local-first" |

---

## Direction Proposée

1. **Sécuriser l'infrastructure** — déplacer clés sensibles, créer Cloud Functions pour appels IA serveur-side, ajouter rate-limiting.
2. **Rendre les features promesses réelles** — intégrer un agrégateur bancaire testé (ou marquer explicitement `/bank` comme "coming soon").
3. **Installer un pipeline CI/CD minimal** — tests + build automatique sur push, déploiement Cloudflare Pages.
4. **Lancer un programme Beta structuré** — captures d'écran utilisateur, feedback loop, analytics PostHog.
5. **Documenter l'API + schémas Firestore** — Zod pour tous les chemins critiques.

---

## Objectif Final

Transformer Libriwouô d'un prototype impressionnant en un produit commercial viable : application déployée, sécurisée, avec authentification robuste, souscriptions payantes fonctionnelles, intégrations bancaires réelles, et engine IA serveur-side fiable. Cible : premier déploiement public après 3 phases d'amélioration.
