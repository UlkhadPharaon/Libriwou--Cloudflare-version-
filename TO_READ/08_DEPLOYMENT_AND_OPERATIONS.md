# Libraiwouô — Déploiement & Opérations

## Infrastructure Cible

**Primary:** Cloudflare Pages (auto-deploy via GitHub integration)  
**Secondary:** Vercel (si Cloudflare pose problème framework-specific)  
**Database:** Firebase Firestore (géré par Google, pas de migration nécessaire)  
**Auth:** Firebase Authentication (Google sign-in + email/password beta)  
**Storage:** Firebase Storage (pour encrypted backups et images utilisateur)  

---

## Variables d'Environnement (Noms Uniquement, Jamais Valeurs)

| Variable | Emplacement | Rôle | Sensible? |
|----------|-------------|------|-----------|
| `VITE_BETA_EMAIL` | `.env`, `wrangler.json` vars → migrer secrets Cloudflare | Email du compte beta démo | ✅ OUI |
| `VITE_BETA_PASSWORD` | `.env`, `wrangler.json` vars → migrer secrets Cloudflare | Password du compte beta démo | ✅ OUI |
| `OPENROUTER_API_KEY` | Env Cloudflare Worker bindings | Clé OpenRouter pour appels IA serveur-side | ✅ OUI |
| `APP_URL` | Env Cloudflare Worker | URL de l'app pour headers HTTP-Referer | Non |
| `OPENROUTER_CHAT_MODEL` | Wrangler.json vars ou Cloudflare env | Modèle LLM chat par défaut | Non |
| `OPENROUTER_VISION_MODEL` | Wrangler.json vars ou Cloudflare env | Modèle LLM vision/OCR par défaut | Non |
| `GEMINI_API_KEY` | `vite.config.ts` define block | Gemini API key (actuellement non utilisé dans build, vérifier si needed) | ✅ OUI (si utilisé) |

### Migration Requise
1. Supprimer `VITE_BETA_EMAIL` et `VITE_BETA_PASSWORD` de la section `[vars]` dans `wrangler.json`.
2. Les ajouter comme **Cloudflare Secrets** (via Dashboard Workers → Settings → Secret Bindings).
3. Créer un fichier `.env.production` avec les variables publiques uniquement (pas de secrets).
4. Ajouter `.env*` au `.gitignore` existant.

---

## Configuration Cloudflare Pages

### Via Dashboard
1. Connecter repo GitHub → `UlkhadPharaon/Libriwouo-NeoComptaAI` (nom à confirmer).
2. Framework preset : **Vite**.
3. Build command : `npm run build`
4. Build output directory : `dist`
5. Root directory : `.`
6. Environment variables : copier depuis `.env.production` (sans secrets) + secret bindings.
7. Deploy hooks : activer pour notifications PR staging.

### Via CLI (alternative)
```bash
npx wrangler pages deploy dist --project-name neocompta-ai
```

---

## Base de Données — Migrations

**Aucune migration de schéma requise immédiatement.** Les collections existantes sont compatibles avec les Zod schemas que nous ajoutons (schemas utiliseront `.partial()` pour backward compatibility).

**Schema à créer :** `waitlist/{email}` (Phase 3.2) — simple document avec `email`, `createdAt`, `source` (landing/beta/referral).

---

## Configuration Stockage

- Firebase Storage buckets existants utilisés pour encrypted backups (`encrypted_fiscal_vaults`).
- Nouveau besoin : stockage temporaire uploads reçus (scan page). Solution : base64 direct au backend (pas de storage intermédiaire), max 5MB per upload dans request body.

---

## Configuration Domaine

Production域名 actuel : à identifier (probablement `neocompta.ai` ou similaire).
1. Configurer DNS records Cloudflare pour le domaine custom.
2. HTTPS automatiquement activé via Cloudflare.
3. Configure `APP_URL` env var avec le domaine production exact.

---

## Sécurité Headers (Production)

Cloudflare Pages supporte `_redirects` file. Créer ou modifier `public/_redirects` :

```
/*    200    /index.html    CMS
```

Sécurité headers ajoutés via Cloudflare Rules → Transform Rules ou via Express server.ts headers middleware:

```typescript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
```

---

## Instructions de Migration

### Phase 1.1 (Credentials Rotation)
1. Changer password beta Firebase Console.
2. Mettre à jour Cloudflare Secret Binding `BETA_PASSWORD`.
3. Tester login beta sur staging.
4. Vérifier git log ancien commits → si credentials anciennes trouvées, rotation immédiate supplémentaire.

### Phase 1.2 (Firestore Rules)
1. Ouvrir Firebase Console → Firestore → Rules.
2. Remplacer règles existantes par version validée.
3. Cliquer "Publish" — attention: changement instantané, aucun rollback natif.
4. Sauvegarder ancienne rules text dans `TO_READ/EVIDENCE/firestore-rules-backup.txt`.

---

## Monitoring & Alerting

**Actuel :** Zéro monitoring prod. À installer Phase 5.2 (PostHog) + Sentry (error tracking).

**Recommandé Phase 5.2+ :**
- PostHog : events funnel, cohort analysis, session replays
- Sentry : error tracking, release tracking, performance monitoring
- UptimeRobot (gratuit) : ping endpoint public toutes les 5 minutes

---

## Backup Strategy

**Data :** Firestore export weekly via Firebase CLI `firebase firestore:databases export`. Automater avec cron/cloud function.
**Config :** Wrangler.toml + Firebase config JSON versionné dans git.
**Code :** Git = source of truth, branch protection main, required reviews.
**IndexedDB clients :** ZK backup encrypté vers Firestore vaults — utilisateurs gèrent leur propre passphrase (no recovery possible — documented in product UI).

---

## Rollback Strategy

1. Cloudflare Pages garde chaque déploiement historique accessible.
2. Cliquer "Rollback" sur le dernier build stable connu.
3. Aucun rollback automatique possible — décision manuelle.
4. En cas de bug critique en prod : rollback immédiat + hotfix sur branche fix → nouveau déploiement.

---

## Vérification Post-Déploiement

Après chaque déploiement production :
1. [ ] Naviguer vers https://domain-production.com — landing loads sans erreur console
2. [ ] Login Google testé avec un compte non-beta
3. [ ] Onboarding complet jusqu'à dashboard
4. [ ] Scan receipt simulé (upload image locale)
5. [ ] Chat hub répond (si OPENROUTER_API_KEY configuré)
6. [ ] Lighthouse audit : performance ≥ 60, accessibility ≥ 90, best-practices ≥ 90
7. [ ] Test mobile Chrome DevTools Galaxy S20 emulation
8. [ ] Console network tab : zéro 4xx/5xx errors
