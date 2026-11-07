# Libraiwouô — Risques & Problèmes Orphelins

## Limitations Connues

| # | Description | Severity | Impact | Mitigation |
|---|-------------|----------|--------|------------|
| L-01 | Page `/bank` n'a aucune intégration bancaire réelle (pas d'agrégateur UEMOA) | 🔴 Blocker | Feature claimée publiquement sur landing page mais non fonctionnelle → perte de crédibilité | Marquer comme "Coming Soon" officiellement ou intégrer un provider réel (3-4 semaines) |
| L-02 | Intelligence Feed déclenché côté client — chaque utilisateur peut payer le même appel Gemini quotidiennement | 🟡 Majeur | Coûts tokens OpenRouter explosent avec adoption, latence élevée pour utilisateurs finaux | Cache KV Cloudflare + unique server-side handler (Phase 1.3) |
| L-03 | Aucun système de paiement/souscription — toutes les features gratuites par défaut | 🔴 Blocker | Impossible de monétiser, revenue = 0 malgré pricing tiers affichés | Intégrer Stripe Phase 3 |
| L-04 | Zéro monitoring production — pas de alertes crashs, uptime tracking, ou error reporting | 🟡 Majeur | Bugs prod invisibles jusqu'à feedback utilisateur direct | PostHog + Sentry Phase 5.2 |
| L-05 | Encrypted cloud backup: si passphrase oubliée, données irrécupérables | 🟡 Majeur | Perte totale de données utilisateur sans moyen de recovery | Documentation renforcée dans UI + email reminder après première sauvegarde |

## Credentials / Services Non Disponibles

| # | Service | État | Blocage |
|---|---------|------|---------|
| C-01 | OpenRouter API Key | Hardcoded dans wrangler.json vars → rotation nécessaire | Rotation credentials Phase 1.1 bloque toute IA functionnalité |
| C-02 | Firebase Project Isolation | Un seul projet Firebase partagé entre tous les testeurs/beta | Pas critique mais risque collision data en multi-user testing |
| C-03 | Stripe Account | Non configuré | Monétisation Phase 3 impossible sans compte Stripe actif |
| C-04 | SendGrid/Resend | Non configuré | Email waitlist Phase 3.2 impossible |
| C-05 | PostHog Project | Non créé | Analytics Phase 5.2 bloquant |
| C-06 | Sentry Organization | Non configuré | Error tracking Phase 5.2 bloquant |
| C-07 | GitHub Repository | Existence confirmée via `git` commands mais URL exacte à vérifier | CI/CD pipeline Phase 5.1 dépend repo accessible |
| C-08 | Production Domain | Nom inconnu | Déploiement public bloqué sans domaine custom |

## Hypothèses Vérifiées Non Confirmées

| # | Hypothèse | Statut | Conséquence si Fausse |
|---|-----------|--------|----------------------|
| H-01 | `@google/genai` SDK est réellement utilisé dans le code productif | ⚠️ NON VÉRIFIÉ — imports trouvés mais usage précis non tracé | Si non utilisé → dependency dead weight → retirer pour réduire bundle size |
| H-02 | Les Firestore Security Rules sont restrictives | ⚠️ À AUDITER — fichier présent mais contenu pas lu dans cette session | Si rules trop ouvertes → tout donnée user visible/écrasable par n'importe qui |
| H-03 | Le moteur fiscal couvre toutes les taxes OHADA applicables au Burkina Faso | ❌ PROBABLEMENT FAUX — seuls CME/RSI/RNI + IUTS + CNSS implémentés | Claims marketing "totalement conforme aux lois locales" sont exagérées → risque légal |
| H-04 | Le build `npm run build` fonctionne localement sur cette machine Windows | ⚠️ À TESTER — déclarations faites mais build jamais exécuté dans cette session | Si échoue → plan d'implémentation basé sur un état irréalisable |
| H-05 | IndexedDB persist storage granted par les navigateurs cibles | ⚠️ PARTIELLEMENT VÉRIFIÉ — `navigator.storage.persist()` appelé mais résultat non logged en prod | Sur certains browsers (iOS Safari), persistence non accordée → données perdues après clear cache |
| H-06 | OpenRouter modèle `inclusionai/ling-3.0-flash-vl:free` disponible et stable | ❓ À VALIDER — modèle free tier subject to availability changes | Si model removed/deprecated → toute feature IA break until fallback configured |

## Dépendances Externes

| Dépendance | Version Actuelle | Criticité | Alternative si Down |
|-----------|-----------------|-----------|---------------------|
| Firebase Auth + Firestore | ^12.12.0 | 🔴 Critique — authentication + data store | Supabase migration estimée 2-3 semaines (breaking change majeur) |
| OpenRouter API (OpenAI compatible) | openai ^6.34.0 | 🔴 Critique — tous les appels IA passent ici | Provider switch → modifier seulement functions/api/*.ts handlers |
| Google GenAI SDK | ^1.29.0 | 🟡 Modérée — possible unused import | Retirer si non-utilisé |
| PDF.js (pdfjs-dist) | ^5.7.284 | 🟢 Mineure — extraction texte PDF uniquement | Fonctionnalités PDF dégradées mais pas core loop break |
| Mammoth (DOCX) | ^1.12.0 | 🟢 Mineure — extraction DOCX uniquement | Idem |

## Décisions Requises Future Human Input

| # | Question | Options | Recommandation |
|---|----------|---------|----------------|
| D-01 | Bank integration : placeholder "coming soon" OU vrai provider? | Option A (rapide, 1 jour) vs Option B (réelle, 3-4 sem) | Option A d'abord → Option B quand traction justifye |
| D-02 | Pricing tiers valides ou à ajuster? | 15K/25K/50K FCFA actuel vs autres | Garder pendant beta validation → ajuster post-traction réelle |
| D-03 | Domaine custom: quel nom? | neocompta.ai / libriwouo.bf / autre | .bf for credibility locale, .ai for tech perception |
| D-04 | Firebase project isolation needed? | Un projet shared vs projects séparés dev/prod/staging | Projects séparés dès lancement public |
