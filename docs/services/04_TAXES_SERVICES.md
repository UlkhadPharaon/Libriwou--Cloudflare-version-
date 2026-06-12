# 📑 SERVICES : TAXATION ET FACTURATION

## 1. Moteur Fiscal UEMOA (`src/lib/tax-rules.ts`)

Ce fichier est l'âme comptable de l'application, codé "en dur" (Hardcoded rules) pour garantir rapidité et respect strict de la doctrine locale.

### Fonctionnalités Clés :
- Regroupe les logiques des 3 régimes d'Afrique de l'Ouest Francophone (Burkina Faso focus) :
  - **CME** (Contribution des Micro-Entreprises).
  - **RSI** (Régime Simplifié d'Imposition).
  - **RNI** (Régime Réel Normal).
- La fonction `calculateTaxes(revenue, expenses, regime)` exécute un test conditionnel précis.
  - S'il s'agit du régime Réel, elle calcule la déductibilité TVA (`TVA collectée` - `TVA déductible`), et l'Impôt sur les Sociétés bloqué par le Minimum Forfaitaire (MFP).
  - Si c'est en CME, elle écrase la TVA (CME = Taux unique non déductible).
  
> **Note d'Ingénierie pour Antigravity** : 
> Dans le futur, exportez ces fonctions dans un package séparé ou un Cloud Run backend pour permettre à l'agent IA de modifier et de re-tester ce code contre des changements de lois chaque fin d'année.

---

## 2. Facturation Native (`src/pages/InvoicePage.tsx`)

Créer un logiciel financier ne sert à rien si l'outil de production (la facture) n'y figure pas.

### Approche Stratégique Documentaire
1. **Zéro Backend PDF** : L'app génère ses PDF (ou plutot ses `docx`) ENTIÈREMENT coté client via le package npm `docx` JS et `file-saver`.
2. **Impact Serveur mitigé** : Aucun flux blob lourd à envoyer entre front et back, tout se déroule dans la machine de l'utilisateur, préservant ainsi la réactivité de l'application.
3. **Double Action** :
   - Formulaire rempli => Téléchargement du bon de côté local de l'OS du client.
   - ET **Ajout silencieux** à Firestore (collection `transactions`, type "INCOME") pour incrémenter instantanément le CA du tableau de bord.
4. **Lien avec l'IA** : Peut être directement invoqué depuis le chat (`HubPage`) si un JSON prérempli d'adresse et de prestation est passé dans l'URL/History state.
