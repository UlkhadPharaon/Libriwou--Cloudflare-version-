# 🏗 GUIDE DE DÉMARRAGE SUR GOOGLE ANTIGRAVITY

Bienvenue sur le projet NeoComptaAI. Ce projet a été structuré via AI Studio et est prêt pour une ingestion "Agentic-First".

## Structure du Projet (Aperçu)

\`\`\`bash
/
├── .env.example            # Variables d'environnement nécessaires (GEMINI_API_KEY, Firestore)
├── index.html              # Point d'entrée Vite
├── package.json            # Dépendances (lucide, recharts, motion, genai)
├── src/
│   ├── App.tsx             # Routing & Protection (Auth Guard)
│   ├── index.css           # Configuration Tailwind & CSS Variables (Dark theme system)
│   ├── components/         # Composants UI globaux (BugReporter, ErrorReporter, Logos)
│   ├── contexts/           # Contexte Firebase Auth (useAuth) et Theme (useTheme)
│   ├── layouts/            # DashboardLayout (Sidebar, Topbar nav)
│   ├── lib/                # Utils (cn pour Tailwind merge, et le cœur tax-rules.ts)
│   ├── pages/              # HubPage, Dashboard, Cashflow, Calendar, Invoice, Scan, Onboarding...
│   └── services/           # Logique Agentique : gemini.ts et intelligence.ts
└── docs/                   # La documentation interne détaillée (Vous y êtes).
\`\`\`

## Intégration sur Antigravity IDE (2026 Edition)

L'import de ce projet dans Antigravity se fera naturellement. 

1. Après avoir extrait l'archive ZIP ou cloné le Repo GitHub :
2. Ouvrez le projet dans l'IDE.
3. Créez un terminal et exécutez `npm i`.
4. Créez un fichier `.env` sur le modèle de `.env.example`.
5. Si cet environnement nécessite son propre Firebase (Firebase Project Isolation), utilisez l'outil agentique intégré à l'IDE ou la CLI pour lancer l'initialisation.

### Instructions pour l'Agent Antigravity
Si vous ("L'Assistant IA Antigravity") gérez ce projet, lisez impérativement l'ensemble du dossier `/docs`. 
- Vous **ne devez pas** casser la disposition Bento du Dashboard (cf: `03_DASHBOARD_AND_CASHFLOW.md`).
- Si une requête fiscale de l'utilisateur implique un calcul d'impôt, vous **devez** mettre à jour le fichier magique `src/lib/tax-rules.ts` en priorité absolue, c'est le "Source Of Truth".
- Le thème est entièrement régi par les variables de root dans le `index.css`. N'utilisez pas de classe de couleurs dures comme `text-blue-500`, utilisez l'écosystème défini comme `text-gold-500` `glow-gold` etc.
