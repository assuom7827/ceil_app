# UX/UI Review — CEIL

## Méthodologie

Analyse statique du code source frontend (fichiers sous `src/app/` et `src/components/`) complétée par une revue de parcours utilisateur. Aucun test utilisateur réel n'a été effectué.

## 1. Architecture UX générale

### Points forts

* **Session comme pivot** : l'espace de travail `/sessions/[id]/workspace` regroupe l'essentiel du métier par onglets, ce qui réduit la navigation.
* **Source unique de vérité** : `services/derive.ts` est utilisé côté client et serveur ; l'utilisateur voit la même valeur que la base.
* **Composants génériques réutilisés** : `ResourceManager`, `ResourceForm`, `EditableGrid` garantissent la cohérence entre écrans.
* **Feedback unifié** : `FeedbackBanner`, toasts shadcn, messages d'erreur sous les champs.

### Points faibles

* **Internationalisation partielle** : de nombreux textes du workspace sont en dur en français, ce qui casse l'expérience arabe.
* **Confirmation destructive faible** : les suppressions en masse n'ont pas de dialogue de confirmation explicite.
* **Aperçu des documents PDF inexistant** : l'utilisateur clique sans voir le résultat avant impression/téléchargement.

## 2. Écrans principaux

### `/login`

| Critère | Évaluation | Remarques |
|---|---|---|
| Compréhension | ✅ | Formulaire simple, champ clairs. |
| Accessibilité | ✅ | `aria-invalid`, `aria-describedby`, `Label htmlFor`. |
| Feedback | ✅ | Message d'erreur unique (sécurité). |
| Amélioration | - | Ajouter un indicateur de chargement pending. Aucun lien mot de passe oublié. |

### `/` (Dashboard)

| Critère | Évaluation | Remarques |
|---|---|---|
| Compréhension | ✅ | KPI visibles, sessions récentes. |
| Navigation | 🟡 | Tableau des sessions non cliquable en entier. Pas d'action rapide « Nouvelle session ». |
| Responsive | ✅ | Grilles adaptatives. |

### `/sessions`

| Critère | Évaluation | Remarques |
|---|---|---|
| Compréhension | ✅ | Liste paginée, état visible. |
| Actions | 🟡 | Colonne actions dense sur petit écran. Suppression bloquée affichée comme disabled sans explication. |

### `/sessions/[id]/workspace`

| Onglet | État UX | Problèmes principaux |
|---|---|---|
| **Inscrits** | 🟡 | Textes en dur ; suppression en masse sans confirmation. |
| **Positionnement** | 🟡 | Libellés et boutons en dur ; pas de feedback si aucun test. |
| **Délibération** | 🟡 | Colonnes en dur, fuite d'encodage `d2019admission` probable (quote unicode). |
| **Groupes** | 🟡 | Interface dense, pas d'indicateur visuel clair de groupe plein. |
| **Documents** | 🟡 | Bouton PDF sans aperçu. |
| **Export** | ✅ | Simple et clair. |

### `/participants`, `/trainings`, `/payments`, `/references`, `/positioning-tests`

| Critère | Évaluation | Remarques |
|---|---|---|
| Compréhension | ✅ | CRUD cohérent. |
| Paiements | 🟡 | Montant numérique sans format monétaire. Sélection participant limitée à 200 éléments. |
| Références | 🟡 | 6 onglets denses ; modèle de diplôme/upload technique, peu guidé. |

### `/users`

| Critère | Évaluation | Remarques |
|---|---|---|
| État | 🟡 | UI en lecture seule. La création d'ADMIN se fait par API (bootstrap). Ergonomie faible pour un admin non technique. |
| Amélioration | - | Ajouter au moins un bouton « Créer » visible pour ADMIN ou documenter clairement. |

### Documents d'impression `/print/...`

| Document | État UX | Remarques |
|---|---|---|
| PV | ✅ | Mise en page A4, signatures enseignants. |
| Diplômes | ✅ | Une page par admis. |
| Attestations | 🟡 | Aucun aperçu PDF. |
| Liste d'émargement | ✅ | Fonctionnelle. |

### `/verify/[id]/[enrollmentId]` (vérification publique)

| Critère | Évaluation | Remarques |
|---|---|---|
| État | 🔴 | Textes en dur, pas de QR code visible, pas de mise en page institutionnelle, RTL non géré. |
| Risque | 🔴 | Expose potentiellement des PII si les IDs sont prévisibles. |

## 3. Accessibilité

### Positif

* `html lang` et `dir` pilotés par la locale.
* `aria-label` sur les boutons icônes et les cellules de grille.
* `role="alert"` / `role="status"` sur les messages d'erreur/succès.
* Navigation clavier dans `EditableGrid` (Entrée, flèches).

### À corriger

* **Tableaux sans conteneur scrollable** : risque de débordement horizontal sur petits écrans.
* **Labels manquants** : certains `<select>` internes à la grille n'ont qu'un `aria-label` ; préférer un label visible.
* **ThemeToggle** : pas d'annonce de changement d'état.
* **DangerouslySetInnerHTML** dans `sheets.tsx` : pas d'aperçu avant impression ; faute de balise = rendu cassé.
* **Compteurs en temps réel** : pas d'`aria-live` sur les compteurs du header de session.

## 4. Responsive

* Layouts principaux adaptatifs (`flex-wrap`, grilles responsives).
* **Problème** : les grilles éditables (`EditableGrid`) ne sont pas encapsulées dans un conteneur `overflow-x-auto`, ce qui provoque du débordement horizontal.

## 5. États de l'interface

| État | Couverture | Remarques |
|---|---|---|
| Chargement | 🟡 | Spinner présent ; pas de bouton « Réessayer » en cas d'échec de chargement d'un onglet. |
| Erreur | 🟡 | FeedbackBanner présent ; gestion des erreurs réseau partielle. |
| Vide | ✅ | Messages `noData`/`noItems` présents. |
| Confirmation | 🔴 | `window.confirm` utilisé ; pas de dialogue shadcn pour les suppressions en masse. |

## 6. Parcours complexes

| Parcours | Complexité | Recommandation |
|---|---|---|
| Inscription en une étape | ✅ Simple | Conserver et documenter. |
| Positionnement → niveaux → groupes | 🟡 Modéré | Ajouter un guide/wizard si utilisateur novice. |
| Configuration modèle de diplôme ODT | 🔴 Complexe | Assistant de téléversement, preview des placeholders. |
| Génération attestations | 🔴 Complexe | Aperçu PDF avant téléchargement. |
| Vérification publique | 🔴 Complexe | Refonte complète (QR code visible, page institutionnelle, protection PII). |

## 7. Recommandations UX prioritaires

| # | Recommandation | Priorité |
|---|---|---|
| 1 | Externaliser tous les textes en dur du workspace dans `messages/fr.json` et `messages/ar.json`. | P0 |
| 2 | Ajouter `overflow-x-auto` autour des grilles éditables ou adopter une vue colonnes adaptative. | P0 |
| 3 | Remplacer `window.confirm` par un dialogue shadcn pour les suppressions en masse. | P1 |
| 4 | Ajouter un aperçu PDF avant téléchargement des attestations. | P1 |
| 5 | Corriger l'encodage/fuite de caractères dans l'onglet Délibération. | P1 |
| 6 | Afficher plus clairement quand un groupe est plein (badge, couleur, tooltip). | P1 |
| 7 | Ajouter un bouton « Réessayer » sur les erreurs de chargement des onglets. | P2 |
| 8 | Refondre la page de vérification publique (QR code, RTL, branding). | P1 |
| 9 | Ajouter le mode sombre explicite et accessible. | P3 |
| 10 | Proposer des quick actions sur le dashboard (Nouvelle session, Inscrire). | P2 |
