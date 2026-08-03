# Testing Review — CEIL

## 1. Stratégie de tests actuelle

| Type | Outil | Couverture observée |
|---|---|---|
| Tests unitaires purs | Vitest | `tests/services/` : dérivés, imports, pagination, RBAC |
| Tests d'intégration | Vitest + vraie base PostgreSQL | API, transactions, contraintes d'unicité, matricules |
| Tests E2E | Playwright | Parcours métier complet et scénarios critiques |

### Chiffres déclarés

* 300 tests Vitest, 18 fichiers.
* 51 tests Playwright, 8 fichiers.

**Note** : ces chiffres n'ont pas été vérifiés en exécutant les suites.

## 2. Évaluation de la couverture

### 2.1 Tests unitaires / purs

#### Couvert ✅

* Fonctions de `derive.ts` (totaux, statuts, niveaux, dates, matricules).
* `imports.ts` : parsing de dates, normalisation d'en-têtes, détection de doublons.
* `pagination.ts` : bornes, tri restreint.
* `rbac.ts` : permissions de base.
* `odt.ts` : manipulation ODT sans LibreOffice.

#### Manques probables

* Branches limites de `derive.ts` (dates approximatives, fuseaux horaires, `matriculePrefix` vide).
* Gestion des erreurs de validation Zod.
* Fonctions de `groups.ts` avec données réelles.

### 2.2 Tests d'intégration

#### Couvert ✅

* Atomicité des compteurs de matricules.
* Contrainte d'unicité des inscriptions.
* `onDelete: SetNull` lors de réorganisation des groupes.
* Routes CRUD standard.

#### Manques importants

* Race conditions sur `assignGroupsByLevel` / `assignExamGroups`.
* Vérification IDOR sur `/api/sessions/[id]/attestation` et `/certificates`.
* Audit non transactionnel.
* Import de notes de positionnement ne créant pas de lignes.
* Suppression en cascade et soft-delete.
* RBAC `USER` excessif.

### 2.3 Tests E2E

#### Couvert ✅

* Parcours métier complet (`e2e/journey.spec.ts`) :
  création session → inscription → import CSV → positionnement → niveaux → groupes → notes → admission → diplôme → PV → verrouillage → déverrouillage.
* Vérification du verrouillage côté UI et API forgée.

#### Manques critiques à couvrir

| Workflow | Priorité | Justification |
|---|---|---|
| Gestion des absences | P0 | Fonctionnalité absente et fondamentale. |
| Tarification et paiements | P0 | Domaine financier sensible. |
| Réinscription ancien participant | P1 | Règle métier spécifique. |
| Annulation/transfert d'inscription | P1 | Statuts d'inscription. |
| IDOR documents | P0 | Failles de sécurité. |
| RBAC utilisateur USER | P0 | Permissions incorrectes. |
| Génération massive de PDF | P1 | Scalabilité. |
| Import de notes de positionnement sur nouvelles lignes | P1 | Bug fonctionnel identifié. |
| Vérification publique d'attestation | P1 | Sécurité + UX. |
| Changement de langue arabe / RTL | P1 | Internationalisation. |

## 3. Matrice de tests recommandée

| Workflow | Unit | Integration | E2E | Priorité |
|---|---|---|---|---|
| Dérivés / calculs | ✅ | - | - | P0 |
| Parsing imports | ✅ | ✅ | - | P0 |
| Création session | - | ✅ | ✅ | P0 |
| Inscription participant | - | ✅ | ✅ | P0 |
| Test de positionnement | - | ✅ | ✅ | P0 |
| Attribution niveaux | - | ✅ | ✅ | P0 |
| Organisation groupes | - | ✅ | ✅ | P0 |
| Affectation groupes | - | ✅ | ✅ | P0 |
| Délibération | - | ✅ | ✅ | P0 |
| Verrouillage session/test | - | ✅ | ✅ | P0 |
| Génération documents | - | ✅ | ✅ | P0 |
| **Absences / présences** | ✅ | ✅ | ✅ | **P0** |
| **Tarification / paiements** | ✅ | ✅ | ✅ | **P0** |
| Réinscription | - | ✅ | ✅ | P1 |
| Annulation/transfert | - | ✅ | ✅ | P1 |
| **IDOR / sécurité documents** | - | ✅ | ✅ | **P0** |
| **RBAC USER** | - | ✅ | ✅ | **P0** |
| Import notes positionnement | - | ✅ | ✅ | P1 |
| Vérification publique | - | ✅ | ✅ | P1 |
| Internationalisation arabe | - | - | ✅ | P1 |
| Export Excel | - | ✅ | ✅ | P2 |
| Notifications | - | ✅ | ✅ | P2 |

## 4. Problèmes de tests identifiés

1. **Sensibilité à l'état de la base** : la suite e2e suppose une base fraîchement ensemencée. Certaines specs prennent la « première session » et supposent qu'elle est ouverte. C'est documenté comme risque.
2. **Tests d'intégration ignorés sans base** : si la CI ne fournit pas `ceil_test`, les tests passent au vert sans rien exécuter. Il faut vérifier le nombre de tests effectivement lancés.
3. **Absence de tests de charge / performance** : pas de K6, pas de test de génération massive de PDF.
4. **Pas de tests d'accessibilité automatisés** : axe-core ou Lighthouse non intégré.
5. **Pas de tests de sécurité automatisés** : pas de tests sur l'IDOR, le rate limiting, le RBAC USER.

## 5. Recommandations

### Immédiates (P0)

* Ajouter des tests E2E pour : absences, tarification, IDOR documents, RBAC USER.
* Ajouter des tests d'intégration pour les points ci-dessus et les race conditions.
* Configurer la CI pour exécuter tous les tests avec PostgreSQL.

### Moyen terme (P1/P2)

* Intégrer axe-core ou `@axe-core/playwright` pour l'accessibilité.
* Ajouter un test de génération PDF sur un lot de 100 attestations avec timeout.
* Tests de performance API simples (k6 ou Playwright + timing).
* Tests de mutation ou couverture de code pour identifier les branches non couvertes.

### Outils suggérés

* `vitest` déjà en place.
* `playwright` déjà en place.
* `@axe-core/playwright` pour a11y.
* `k6` ou `autocannon` pour perf.
* ` Istanbul / v8 coverage` natif via vitest.
