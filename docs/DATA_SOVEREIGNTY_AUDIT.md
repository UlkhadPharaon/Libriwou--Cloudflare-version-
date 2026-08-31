# Libriwouô — Audit de souveraineté des données

**État : NON CONFORME — ne pas présenter l'application comme locale ou zéro-connaissance.**

Date d'audit : 2026-08-07  
Portée : branche `main`, commit `c316922`.

## Exigence produit cible

- Les données métier (profil entreprise, IFU/RCCM, transactions, factures, inventaire, paie, conversations, simulations, pièces et exports) ne quittent jamais l'appareil par défaut.
- Google/Firebase est autorisé uniquement pour l'authentification. Il ne stocke aucune donnée métier.
- La vérification d'abonnement est un service séparé, minimisé : identifiant pseudonyme, plan, état, dates d'expiration. Aucun contenu comptable.
- Toute sortie de données vers une IA ou un autre tiers doit être désactivée par défaut et soumise à un consentement explicite, précis et révocable.

## Verdict actuel

L'application possède un début de stockage local (`src/services/localDb.ts`) pour `transactions`, `inventory`, `stock_movements` et `companies`, mais elle n'est pas local-first de bout en bout.

Des données métier sont actuellement envoyées à Firebase/Firestore, notamment le profil d'entreprise, les conversations, les simulations, les références, des transactions, les éléments de paie et les documents. Les appels IA peuvent en outre transmettre messages, données calculées et documents à Cloudflare Workers puis à NVIDIA NIM; la veille transmet le secteur à Cloudflare/Tavily/NVIDIA.

## Flux distants constatés

| Destination | Données concernées | Preuve code | Statut cible |
|---|---|---|---|
| Firebase Authentication / Google | Identité, métadonnées d'authentification | `src/firebase.ts` | Autorisé, uniquement pour l'authentification |
| Firestore | Profil légal, IFU, RCCM, e-mail, adresse, transactions, conversations, simulations, paie, références, etc. | imports Firestore dans de nombreuses pages; onboarding `src/pages/OnboardingPage.tsx:56` | À supprimer pour les données métier |
| Firebase cache persistant | Copie locale non chiffrée des documents Firestore | `src/firebase.ts:8-12` | À supprimer avec Firestore client |
| Firebase coffre chiffré | Sauvegarde chiffrée des données métier | `src/services/localDb.ts:401-424` | Désactivé par défaut; remplacer par export/import local. Cloud backup seulement opt-in et réellement zéro-connaissance après audit cryptographique |
| Cloudflare Worker | Corps des requêtes IA et métadonnées réseau | `src/worker.ts` | À réserver aux fonctions explicitement consenties; pas de données métier par défaut |
| NVIDIA NIM | Chat, analyse OCR et références; image/base64 ou texte de documents | `functions/api/chat.ts`, `vision.ts`, `reference.ts` | Désactivé par défaut; consentement par opération ou IA locale |
| Tavily + NVIDIA | Secteur utilisateur lors de la veille | `functions/api/intelligence.ts` | Désactivé par défaut ou données agrégées/non identifiantes |
| Google Fonts | Adresse IP et métadonnées navigateur | `src/index.css:1` | Auto-héberger les polices |

## Faiblesses à corriger avant production

1. **Firestore est un backend métier actif.** Les pages utilisent `onSnapshot`, `getDocs`, `addDoc`, `setDoc` et `updateDoc` pour les données des utilisateurs.
2. **Le stockage local n'est pas chiffré au repos.** IndexedDB contient les objets en clair; `localDb.ts` chiffre uniquement l'export de sauvegarde cloud. Un utilisateur du même poste/profil navigateur ou un malware local peut lire la base.
3. **Le chiffrement de sauvegarde est insuffisamment paramétré.** PBKDF2-SHA-256 à 80 000 itérations dans `localDb.ts:16-27` est inférieur aux recommandations modernes; il faut Argon2id (WebAssembly) avec paramètres mémoire documentés, ou à défaut PBKDF2 nettement renforcé et versionné.
4. **L'IA externe reçoit des données sensibles.** Une facture, un reçu, une conversation ou une référence envoyés à `/api/vision`, `/api/reference` ou `/api/chat` peut contenir des données personnelles et financières.
5. **Règles Firestore incompatibles avec la promesse souveraine.** `firestore.rules:150-151` laisse tout utilisateur connecté écrire `intelligence_feed`. Les droits administrateur donnent aussi une capacité de lecture de données métier dans de nombreuses collections.
6. **Le code importe Google Fonts depuis le réseau.** Cela crée un appel Google hors authentification.

## Architecture cible : Local-first souverain

```text
Navigateur/PWA
  ├─ Firebase Auth (Google uniquement) ────── identité / jeton
  ├─ IndexedDB chiffrée (toutes les données métier)
  │    └─ clé dérivée localement de la phrase secrète utilisateur
  ├─ Moteur fiscal, facture, exports ─────── entièrement local
  ├─ Export/import chiffré local ─────────── fichier contrôlé par l'utilisateur
  ├─ [opt-in] IA cloud ───────────────────── envoi visible, limité et ponctuel
  └─ [opt-in] abonnement ─────────────────── uid pseudonyme + plan + expiration

Cloudflare Worker
  ├─ vérifie le jeton Firebase
  ├─ sert le statut d'abonnement minimal
  └─ ne persiste aucune donnée métier
```

## Plan de migration obligatoire

### Phase 0 — Stopper les promesses trompeuses

- Retirer les textes affirmant que les données restent « à 100 % locales » tant que Firestore et les appels IA externes restent actifs.
- Ajouter dans l'interface un écran de transparence des flux, avec consentement IA désactivé par défaut.

### Phase 1 — Couper Firestore métier

- Conserver `firebase/auth` seulement.
- Supprimer `initializeFirestore`, toutes les importations `firebase/firestore`, l'accès `db` et les règles Firestore métier.
- Étendre une couche locale unique à toutes les collections : entreprise, transactions, inventaire, paie, factures, conversations, simulations, références, préférences et pièces.
- Remplacer les listeners Firestore par des abonnements à la couche locale.

### Phase 2 — Chiffrement local réel

- Chiffrer chaque enregistrement ou l'intégralité du magasin IndexedDB avant écriture.
- Ne jamais conserver la phrase secrète ni la clé dérivée en stockage persistant.
- Utiliser Argon2id, AES-256-GCM, un sel aléatoire et un IV unique par chiffrement; versionner le format.
- Ajouter verrouillage automatique, purge de la clé mémoire et procédure de récupération clairement expliquée.

### Phase 3 — Services externes minimisés

- Auto-héberger les polices et supprimer toute télémétrie non nécessaire.
- IA cloud : modal de consentement par document/conversation précisant le fournisseur, les champs envoyés et la finalité. Offrir un mode sans IA cloud.
- Ne jamais injecter automatiquement le profil, les transactions ou les conversations dans une requête IA.
- Paiement : stocker côté serveur uniquement `subjectId` pseudonyme, `plan`, `status`, `expiresAt`, `providerCustomerRef` tokenisé. Aucun nom, IFU, facture, transaction ou conversation.

### Phase 4 — Preuves de sécurité

- Tests automatisés de non-régression : aucune requête réseau lors des opérations métier en mode souverain.
- Content Security Policy stricte et audit des dépendances.
- Tests de chiffrement, migration, effacement local et export/import.
- Revue indépendante avant de revendiquer « zéro connaissance » ou « souveraineté des données ».

## Règle de communication produit

Ne pas utiliser « personne, même Google, ne peut accéder aux données » avant la fin des phases 1 à 4 et une revue indépendante. La formulation honnête actuelle est :

> « Libriwouô est en migration vers une architecture local-first. Certaines fonctionnalités transmettent encore des données à Firebase et/ou à des fournisseurs IA lorsqu'elles sont utilisées. »
