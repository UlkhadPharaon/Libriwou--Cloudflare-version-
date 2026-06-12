# 📘 NEO COMPTA AI - LE MANUEL ARCHITECTURAL (BIBLE DU PROJET)

Ce document explore l'intégralité de l'architecture, de la vision et des règles d'ingénierie du projet NeoComptaAI pour faciliter sa reprise dans le nouvel IDE Google Antigravity.

## 🌟 1. Vision et Positionnement du Produit
**NeoComptaAI** est bien plus qu'un logiciel comptable ; c'est un "Agent-as-a-Software" (Agent en tant que logiciel). Conçu spécifiquement pour l'espace **UEMOA** (et optimisé initialement pour le Burkina Faso), il s'agit d'un **Copilote Financier** visant à rendre la fiscalité, la comptabilité et la gestion d'entreprise intuitives, premium et proactives pour les TPE/PME et indépendants africains.

### La Cible Principale
- **Demographie** : Les entrepreneurs, auto-entrepreneurs, TPE et PME résidant dans l'espace régional OHADA.
- **Pain Points (Problèmes résolus)** :
  1. Opacité et complexité du système fiscal local (SYSCOHADA, CGI).
  2. Coût élevé des experts-comptables pour les petites structures.
  3. Peur du contrôle fiscal et du non-respect des échéances (pénalités).
  4. Gestion archaïque de la paperasse (factures perdues, saisie manuelle lourde).

### Avantages Compétitifs (Moat)
1. **L'IA au cœur (AI-First)** : Contrairement aux logiciels SaaS classiques qui ont ajouté l'IA a posteriori, Neo a été pensé *autour* d'un cerveau Gemini. L'interface sert l'IA, et non l'inverse.
2. **Design "Quiet Luxury"** : Un parti-pris esthétique fort (mode sombre, teintes or/luxueuses, flous et néons discrets). L'application rassure le dirigeant et lui donne l'impression d'avoir un "banquier privé" à sa disposition.
3. **Hyper-Localisation** : Règles fiscales pré-codées (CME, RSI, RNI) conformes aux taux ouest-africains, offrant une valeur immédiate "Out-of-the-box" sans configuration laborieuse.
4. **Intégration Tooling Agentique** : L'IA navigue sur internet en temps réel pour trouver des appels d'offres locaux, des subventions ou surveiller la Loi de Finances.

---

## 🛠 2. La Stack Technologique

Le choix de la stack garantit rapidité, évolutivité et fluidité front-end.

*   **Runtime & Framework** : Node.js, **Vite**, **React 18** (TypeScript obligatoire).
*   **Routing** : `react-router-dom` pour une navigation Single Page Application (SPA).
*   **Styling & UI** : **Tailwind CSS** (utilisé avec une structure de CSS Variables sur-mesure dans `index.css` pour un système de *Theming Dynamique* Dark/Light).
*   **Animations** : `motion/react` (Framer Motion) pour des entrées douces, des micro-interactions premium et la physique de l'interface.
*   **Intelligence Artificielle** : Le SDK officiel TypeScript `@google/genai`. 
    *   Utilisation de *Gemini 1.5 Flash* pour la vélocité (ex: OCR des reçus, structuration JSON).
    *   Utilisation de requêtes avec **Function Calling** pour l'agenticité du Hub IA.
*   **Backend & Base de données** : **Firebase**.
    *   `Firebase Authentication` (Email/Google).
    *   `Firestore` (NoSQL, écoute en temps réel via WebSockets, gestion des règles de sécurité coté cloud).
*   **Outils tierces** : 
    *   `Recharts` (Graphiques et Data Visualisation).
    *   `docx` & `file-saver` (Génération des factures formelles à la volée coté client).
    *   `lucide-react` (bibliothèque iconographique épurée).

---

## 🧠 3. Fonctionnement de l'Intelligence Artificielle (Le Cerveau)

### L'Orchestration Agentique (Tool Calling)
Neo n'est pas un simple chatbot (LLM). Il possède des "mains". Le fichier `src/services/gemini.ts` définit des outils (Tools) que l'IA peut appeler spontanément :
*   `propose_transaction` : Permet à Neo de créer une carte de transaction cliquable pour que l'utilisateur valide l'ajout d'une dépense en base de données à l'issue d'une conversation ou de l'upload d'un devis.
*   `update_company_profile` : Permet à l'IA de changer elle-même les paramètres de l'entreprise si l'utilisateur le lui demande.
*   `generate_invoice` : Déclenche le générateur de facture avec les champs clients pré-remplis suite à une simple directive vocale ou écrite ("*Fais une facture pour tel client...*").

### L'Agent de Veille Stratégique (L'Écho de Neo)
Situé dans `src/services/intelligence.ts`, cet agent "cron-like" effectue des recherches sur l'Internet (Google Grounding). Il cherche les opportunités (marchés publics) et lois applicables au profil métier précis de l'entreprise, puis retourne un JSON déterministe qui est sauvegardé dans Firestore pendant 24h, créant une section "News" vivante sur le Dashboard.

---

## 🏗 4. Architecture des Données (Firestore)

1.  **Collection `companies`** : Un document par utilisateur `uid`.
    *   Contient le RNI, IFU, Régime (CME, RSI), Secteur.
    *   Tracking de l'Avatars IA (`aiCompanionName`).
2.  **Collection `transactions`** : Entrées comptables brutes.
    *   Type (INCOME, EXPENSE), Montant, TVA.
3.  **Collection `conversations`** : L'historique des chats dans le Hub IA.
4.  **Collection `daily_intelligence`** : Cache du jour pour les opportunités et veilles stratégiques.

---

## 🧬 5. L'avenir & Next Steps pour Antigravity 
En reprenant cette Codebase dans **Antigravity** (IDE de 2026), vous pourrez capitaliser sur la structure modulaire actuelle pour :
- **Intégrer Firebase Functions (Backend Node)** afin de faire tourner l'agent "Écho de Neo" hors du front-end.
- **Relier de vraies structures Oauth Bancaires** (via un agrégateur UEMOA) dans le composant vide `/bank`.
- **Créer des WebSockets / WebRTC** pour que l'avatar `CompanionAvatar.tsx` puisse intégrer la Live API de Gemini (Voice Multimodale temps réel avec retour audio).
