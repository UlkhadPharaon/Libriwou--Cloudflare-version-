# Libriwouô — Politique de souveraineté des données

## Statut de migration

Libriwouô est en cours de migration vers une architecture **local-first**. Cette page décrit la cible de sécurité du produit et les limites à respecter pendant la migration.

## Notre engagement cible

Les données comptables et fiscales de l'utilisateur sont conservées sur son appareil : profil d'entreprise, IFU, RCCM, transactions, inventaire, paie, factures, pièces, exports, simulations et conversations.

Google/Firebase est limité à l'authentification. La gestion d'abonnement, lorsqu'elle est activée, ne doit traiter que l'identifiant pseudonyme du compte, l'état de l'abonnement et sa période de validité. Elle ne doit jamais traiter les données comptables de l'utilisateur.

## Aucun transfert silencieux

Une donnée métier ne doit pas être envoyée vers un service tiers sans une action volontaire, une information claire sur le destinataire et la finalité, et un consentement explicite de l'utilisateur.

Les fonctions IA cloud sont donc optionnelles. Avant l'envoi d'un document ou d'une conversation à un fournisseur IA, Libriwouô doit afficher :

- le fournisseur destinataire ;
- les données exactes qui seront envoyées ;
- la finalité de l'analyse ;
- une alternative sans IA cloud lorsque disponible.

## Sécurité locale cible

Les données locales doivent être chiffrées avant écriture dans le stockage du navigateur avec une clé détenue uniquement par l'utilisateur. La clé ne doit jamais être envoyée au serveur ni stockée de manière persistante.

L'utilisateur reste responsable de sa phrase secrète et de ses copies de sauvegarde. Une phrase secrète perdue ne peut pas être récupérée par Libriwouô : c'est la condition nécessaire d'un modèle réellement zéro-connaissance.

## Sauvegardes

Par défaut, les sauvegardes sont exportées localement par l'utilisateur. Toute sauvegarde cloud est désactivée par défaut et ne peut être proposée que lorsqu'elle est chiffrée côté client, avec une clé non accessible à Libriwouô ni au fournisseur de stockage.

## Transparence

Nous ne devons pas revendiquer « zéro connaissance », « confidentialité absolue » ou « aucune donnée n'est envoyée » avant que l'architecture, les tests et un audit de sécurité indépendant ne le démontrent.

Pour l'état technique détaillé et le plan de correction, consulter `docs/DATA_SOVEREIGNTY_AUDIT.md`.
