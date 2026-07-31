# État du projet

**Dernière mise à jour : 2026-07-30.** Ce fichier dit où en est le travail et ce
qui reste ouvert. Il se met à jour à chaque livraison ; l'historique complet est
dans [`CHANGELOG.md`](../CHANGELOG.md).

## Avancement

| Étape                                          | État |
| ---------------------------------------------- | ---- |
| 1 — Scaffold                                   | ✅   |
| 2 — Modèle de données normalisé, dérivés, seed | ✅   |
| 3 — Couche services métier                     | ✅   |
| 4 — API REST, RBAC serveur, erreurs            | ✅   |
| 5 — Authentification, rôles, shell             | ✅   |
| 6 — Espace de travail Session                  | ✅   |
| 7 — CRUD des référentiels et du catalogue      | ✅   |
| 8 — Documents officiels imprimables            | ✅   |
| 9 — Parcours e2e complet                       | ✅   |
| 10 — Documentation et mémoire du projet        | ✅   |
| Gabarit d'attestation ODT téléversable         | ✅   |

Le cycle métier est couvert de l'inscription aux documents officiels, et vérifié
de bout en bout dans un vrai navigateur.

### Chiffres

| Mesure            | Valeur                |
| ----------------- | --------------------- |
| Tests Vitest      | 300, dans 18 fichiers |
| Tests Playwright  | 51, dans 8 fichiers   |
| Route Handlers    | 54                    |
| Migrations Prisma | 4                     |
| Modèles Prisma    | 16                    |

## Questions ouvertes

Aucune ne bloque le fonctionnement ; toutes appellent une confirmation du CEIL.
L'hypothèse retenue est celle qui casse le moins si elle est fausse.

| Question                                                                                                                | Hypothèse en place                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quel est le **barème réel du test de positionnement** ?                                                                 | 0..100, E.E et C.E supposées sur 50 chacune (barème du seed)                                                                                                      |
| La nomenclature des **mois arabes** est-elle bien la convention algérienne ?                                            | Oui — `جانفي`, `فيفري`… ([D-24](./decisions.md#d-24))                                                                                                             |
| Une ligne sans note doit-elle être **« non délibérée » ou « ajournée »** ?                                              | Non délibérée ([D-05](./decisions.md#d-05))                                                                                                                       |
| Faut-il relier `Speciality` à `Participant` ?                                                                           | Non relié — la table existe, la relation n'a pas été demandée                                                                                                     |
| Le **sexe** doit-il figurer sur les documents (accord arabe طالب / طالبة) ?                                             | Non utilisé — le champ existe mais n'est ni imprimé ni importable                                                                                                 |
| Quelles sont les **formulations réglementaires** des diplômes et attestations ?                                         | Rédaction provisoire dans `src/components/documents/sheets.tsx`                                                                                                   |
| Le **numéro de registre** de l'attestation (`رقم : 1526/ج م/م ت م ل/2026`) est-il distinct du matricule d'inscription ? | Non implémenté — le gabarit utilise `{{matricule}}`. Un registre propre suppose de connaître la politique de numérotation (par an ? par centre ? remise à zéro ?) |
| Le **gabarit d'attestation** doit-il être réservé aux responsables ?                                                    | Non — il suit les droits de `DiplomaModel`, où `USER` peut écrire ([D-11](./decisions.md#d-11))                                                                   |

## Limites connues

- **Formulations des documents officiels** : le **procès-verbal**, les
  **diplômes HTML** et les **attestations d'inscription** portent une rédaction de
  travail, à remplacer par le texte du CEIL. L'**attestation de réussite** échappe
  à cette limite : sa formulation vit dans le gabarit ODT, donc entre vos mains
  ([D-26](./decisions.md#d-26)).
- **QR code de l'attestation** : l'application ne génère aucun QR code. Un code
  fixe placé dans le gabarit sera identique sur toutes les attestations ; un code
  propre à chaque personne suppose de l'insérer comme image dans l'ODT, ce qui
  n'est pas fait.
- **Un seul type de gabarit** : seule l'attestation de réussite est téléversable.
  Le procès-verbal et les listes restent des pages HTML.
- **Identité visuelle** : couleurs et logo de l'université ne sont pas intégrés.
  L'habillage actuel est volontairement neutre ([D-19](./decisions.md#d-19)).
- **Aucun export Excel** : les imports existent, l'export non. Les listes
  s'impriment (A4) mais ne se téléchargent pas en classeur.
- **`papaparse` est déclaré mais inutilisé** : `xlsx` lit aussi bien les CSV.
  À retirer de `package.json`, ou à employer si un besoin CSV spécifique apparaît.
- **Pas de mode sombre** : le thème est clair uniquement.
- **Enregistrement ligne par ligne** dans la grille des inscrits : une requête
  `PATCH` par ligne modifiée. Acceptable aux effectifs observés, à remplacer par
  un point d'entrée de mise à jour en masse si les sessions grossissent.
- **Sélection du participant sur un reçu** : liste déroulante de 200 éléments,
  sans recherche asynchrone.
- **Pas de génération PDF côté serveur** : les documents sont imprimés par le
  navigateur ([D-01](./decisions.md#d-01)).
- **Aucune trace d'audit** : on ne sait pas qui a modifié une note ni quand.
  À prévoir si les délibérations doivent être opposables.
- **Suite e2e sensible à l'état de la base** : plusieurs specs prennent « la
  première session de la liste » et la supposent ouverte. Sur une base de
  développement où les exécutions se sont accumulées, ou après un run interrompu
  qui laisse une session verrouillée, elles échouent pour de mauvaises raisons.
  La suite passe intégralement sur une base fraîchement ensemencée.

## Prochaines étapes possibles

Par ordre de valeur perçue, aucune n'étant engagée :

1. **Texte réglementaire des documents** restants (PV, listes) — l'attestation
   de réussite ne dépend plus du code.
2. **Numéro de registre des attestations**, si le CEIL confirme qu'il diffère du
   matricule d'inscription.
3. **Identité visuelle du CEIL** (logo, couleurs de l'université).
4. **Bouton « Télécharger le modèle »** à côté de chaque import : le classeur
   d'exemple existe déjà, il n'est pas atteignable depuis l'application.
5. **Export Excel** des listes et du procès-verbal.
6. **Trace d'audit** sur les notes et les décisions d'admission.
7. **Mise à jour en masse** des inscriptions, et recherche asynchrone des
   participants.
8. **Spécialisation des specs e2e** : chacune créant sa propre session, comme le
   fait déjà `documents.spec.ts`.
