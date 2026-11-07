# Prompt d'Exécution — Agent Ingénierie Exécutive

## Contexte Produit

**Application :** Libriwouô (NeoCompta AI)  
**Répertoire :** `E:/Ulkhad Empire/Tech Empire/Libriwouô( Ulrich X Gilberte)/SaaS/Libriwouô v1.5/`  
**Lecture obligatoire :** Lis TOUTES les 9 documents dans le dossier `TO_READ/` **AVANT** de modifier le moindre fichier source.

```
00_EXECUTIVE_SUMMARY.md    → Vue d'ensemble produit + état actuel + faiblesses
01_PROJECT_RECONSTRUCTION.md  → Architecture détaillée, routes, BDD, IA
02_EGM_DEEP_AUDIT.md       → Audit EGM avec scores et recommandations prioritaires
03_MARKET_AND_PRODUCT_STRATEGY.md → ICP, concurrents, monétisation
04_UX_UI_AND_LANDING_PAGE.md    → Design system, architecture pages, funnel conversion
05_MASTER_IMPLEMENTATION_PLAN.md → Plan maître PHASE 1-6 avec task IDs, dépendances, critères
07_TESTING_AND_ACCEPTANCE_MATRIX.md   → Checklist tests fonctionnels, régression, sécurité
08_DEPLOYMENT_AND_OPERATIONS.md      → Infrastructure, env vars, déploiement Cloudflare
09_RISKS_AND_OPEN_ISSUES.md          → Limitations connues, assumptions non vérifiées
```

## Instructions Opérationnelles

### Règle 0 : Vérifier l'état du projet AVANT de coder
1. Lancer `npm ci` dans le répertoire project pour installer les dépendances exactes.
2. Lancer `npm run lint` (= `tsc --noEmit`) pour vérifier que le codebase compile actuellement.
3. Lire `src/lib/tax-rules.ts` et `firestore.rules` pour comprendre l'état actuel du moteur fiscal et des règles BDD.
4. Comparer les faits découverts avec ce qui est documenté dans `01_PROJECT_RECONSTRUCTION.md`. Note toute divergence.

### Règle 1 : Exécuter PHASE PAR PHASE selon 05_MASTER_IMPLEMENTATION_PLAN.md
Ne pas sauter de phases. Chaque phase doit être validée avant de commencer la suivante :
- Phase 1 (Sécurité) → valider que credentials sont protégés avant Phase 2
- Phase 2 (Validation Données) → valider schémas Zod compilent avant Phase 3
- Phase 3 (Monétisation) → valider Stripe checkout flow testable localement
- etc.

### Règle 2 : Préserver la fonctionnalité existante
- Ne PAS supprimer ou modifier le moteur de calcul fiscal `tax-rules.ts` sans écrire des tests équivalents AU MOINS avant modification.
- Ne PAS changer le schema IndexedDB version 2 existant (libriwouoLocalDB) sans migration script compatible.
- Le thème "luxury dark" (`index.css` CSS variables) ne doit pas être réécrit — utilisé partout.
- La structure routing `App.tsx` (ProtectedRoute logic) ne doit pas être modifiée sans approbation explicite.

### Règle 3 : Tester_INCREMENTALEMENT
Après chaque tâche implémentée :
1. Relancer `npm run build` et confirmer qu'il termine sans erreur.
2. Si possible, lancer `npm run dev` et tester manuellement la feature ajoutée/modifiée.
3. Noter tout bug découvert et le fixer immédiatement — ne pas empiler les bugs.

### Règle 4 : Jamais promettre une feature comme "fonctionnelle" sans l'avoir testée
Si Stripe API key n'est pas disponible → implémenter le flow UI mais ajouter un flag `STRIPE_NOT_CONFIGURED` banner. Documenter ce blocage explicitement dans le rapport final.

### Règle 5 : Respecter les conventions techniques existantes
- TypeScript strict — aucun `any` ajouté dans nouvelles lignes de code (sauf pour legacy bridge vers Firebase `as any`).
- Tailwind CSS v4 — utiliser les classes utility standard, pas de CSS custom sauf dans `index.css` variables.
- Imports relatifs — respecter la convention relative path déjà en place.
- Noms de fonctions : camelCase, verbes action pour handlers (`handleSave`, `handleSubmit`).

### Règle 6 : Sécurité par défaut
- Jamais hardcoder clé API dans le code client-side. Toute clé → `import.meta.env.VITE_XXX` ou Cloudflare Secret Binding.
- Toute donnée utilisateur sensible → chiffrée localement avant écriture Firestore.
- Validation Zod sur TOUS les chemins d'entrée/sortie Firestore.

## Ordre Exact d'Exécution

```
Step 1  →  LIRE TO_READ/01_PROJECT_RECONSTRUCTION.md (architecture complète)
Step 2  →  LIRE TO_READ/02_EGM_DEEP_AUDIT.md (audit EGM)
Step 3  →  LIRE TO_READ/05_MASTER_IMPLEMENTATION_PLAN.md (plan tâches)
Step 4  →  Exécuter npm ci && npm run lint (vérification état initial)
Step 5  →  PHASE 1.1 : Credentials rotation & Cloudflare secrets
Step 6  →  PHASE 1.2 : Firestore security rules validation
Step 7  →  PHASE 1.3 : Server-side intelligence caching
Step 8  →  PHASE 2.1 : Zod schemas installation + application
Step 9  →  PHASE 2.2 : Extension tax-rules.test.ts coverage
Step 10 →  PHASE 3.1 : Stripe integration + feature gating
Step 11 →  PHASE 3.2 : Waitlist email capture
Step 12 →  PHASE 4.1 : Bank page status update (coming soon screen)
Step 13 →  PHASE 5.1 : GitHub Actions CI/CD workflow
Step 14 →  PHASE 5.2 : PostHog analytics installation
Step 15 →  PHASE 6.1 : LandingPage component refactoring
Step 16 →  PHASE 6.2 : Mobile performance audit & optimization
Step 17 →  LIRE TO_READ/07_TESTING_AND_ACCEPTANCE_MATRIX.md
Step 18 →  Exécuter tous les tests + build final
Step 19 →  Rédiger rapport final engineering (résultats, bugs, bloquants restants)
```

## Deliverables Finaux Attendus

Après exécution complète :

1. **Codebase refactorisé** — Tous les fichiers modifiés listés ci-dessus. Build propre.
2. **TO_READ/EVIDENCE/screenshots/** — Captures d'écran du dashboard post-refactor + build log console output.
3. **Report Final** : Un fichier `FINAL_ENGINEERING_REPORT.md` à la racine avec :
   - Résumé de ce qui a été fait
   - Liste de tous les fichiers modifiés/ajoutés
   - Bugs découverts et corrigés
   - Blocants restants (si aucun, "Aucun")
   - Commande de déploiement finale
   - Next steps recommendations

## Avertissement Critique

Si pendant l'exécution tu découvres une faille de sécurité critique (ex: firestore.rules totalement ouvert), STOPPE tout le reste, fixes cette faille IMMÉDIATEMENT, note-la dans ton rapport, puis reprends le plan depuis le début.
