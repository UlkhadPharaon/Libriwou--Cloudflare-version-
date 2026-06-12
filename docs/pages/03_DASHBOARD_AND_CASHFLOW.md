# 📊 PAGES : DASHBOARD & TRÉSORERIE (CASHFLOW)

## A. Tableau de Bord Principal (`src/pages/DashboardPage.tsx`)

Le Dashboard emploie une disposition en "Bento Grid" super optimisée (responsive) pour offrir une vue macroscopique immédiate de la rentabilité.

### Les éléments de la "Bento Grid"
1. **Bento "Résultat Net"** : Calcule le total (Revenus - Dépenses - Impôts calculés via la bibliothèque interne `tax-rules.ts`).
2. **Bento "Métriques"** : Tuiles indépendantes (Revenus, Dépenses, Total Impôts, Score de Santé de la boîte).
3. **Bento "Aperçu Croissance"** : 
   - Utilise `recharts` pour générer un AreaChart lissé (`type="monotone"`).
   - Affiche les bénéfices mensuels sur l'année.
4. **Bento "Écho de Neo" (Strategic Intelligence)** :
   - Zone critique de rétention utilisateur : Elle liste 5 "Pilules d'action" générées quotidiennement par l'IA via Google Search (appels d'offres, modifications fiscales du Burkina).
   - Possède un bouton **"En savoir plus"** et un bouton violet **"Analyser avec l'IA"**. Ce dernier passe un paramètre de requête URL qui va instantanément ouvrir le *Hub IA* et déclencher une conversation à propos de l'article cliqué.

---

## B. Trésorerie Séparation (`src/pages/CashflowPage.tsx`)

Créée pour séparer la vue "Passé" de la vue "Futur".

### Fonctionnement du Forecasting (Projection IA)
L'intelligence du système réside dans son hook `useMemo` :
1.  Il agglomère l'ensemble des transactions (Revenus et Dépenses) de chaque mois passé.
2.  Il en extrait une moyenne mobile.
3.  Il *extrapole* (ajoute) 3 mois futurs "fantômes" sur le graphique avec un changement de style.
4.  L'assistant se base sur le solde de ce +3 mois pour rendre un verdict conditionnel (Composant "Conseil de votre assistant IA") :
    - *Solde positif de projection* = Suggestion d'optimisation, d'investissement ou d'épargne.
    - *Solde négatif de projection* = Warning en texte rouge : "Risque de découvert, modérez les charges fixes".
