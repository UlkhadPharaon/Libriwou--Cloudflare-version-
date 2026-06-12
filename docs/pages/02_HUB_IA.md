# 🤖 PAGE: LE HUB IA (L'Expérience Cœur)

`src/pages/HubPage.tsx`
`src/services/gemini.ts`

## 1. Ce que c'est
Le Hub IA est le noyau de l'application. Contrairement à un dashboard classique, c'est ici que l'utilisateur travaille le plus. Il s'agit d'une interface de chat repensée comme un "Espace de collaboration" entre l'humain et Neo (son expert-comptable de poche).

## 2. Spécificités UX/UI
- **Companion SVG (L'Avatar)** : Un composant custom (`CompanionAvatar.tsx`) agit comme point focal. Il s'anime légèrement. Le nom du compagnon ("Neo", "Marie", etc.) est dynamique selon les `Settings` de l'utilisateur.
- **Support Multimodal Frontal** : 
  - La zone d'input gère à la fois le texte.
  - La "Drag & Drop Zone" pour balancer nativement un reçu au format PDF ou JPEG.
  - L'api Web Speech pour parler directement à l'IA avec son micro (Bouton Micro).

## 3. Le Processus Logique d'une requête (Agentic Loop)
Quand l'utilisateur envoie une requête :
1.  **Injection du Contexte** : L'état actuel de son entreprise (Transactions du mois, régime fiscal, chiffre d'affaire global) est silencieusement injecté dans le prompt système envoyé à Gemini (voir `generateUserContext` dans la page, et `sendChatMessage` dans le service). L'IA "sait" toujours à qui elle parle.
2.  **Appel du LLM (`sendChatMessage`)** : Gemini réfléchit. Soit il répond du texte brut, soit il requiert d'utiliser un **Outil** (Tool calling).
3.  **Traitement des Actions (`handleAIAction`)** :
    - Si l'IA estime qu'il faut créer une facture (`generate_invoice`), React route l'utilisateur de force (via `Link`) vers la page facturation et transporte les données en mémoire (Location state).
    - Si l'IA liste une facture analysée par image (`propose_transaction`), un composant UI interactif apparaît dans le chat avec le montant pré-rempli. L'utilisateur peut l'approuver ou l'éditer avant envoi dans Firestore.

## 4. Outils utilisés
- `@google/genai` pour la modélisation et le function calling.
- `react-markdown` combiné avec `@tailwindcss/typography` (`prose prose-invert`) pour un rendu sublime et propre des réponses de l'IA (mise en gras, listes à puce). 
