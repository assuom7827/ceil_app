# Sprint 7 — Campagne de tests E2E de régression

**Objectif** : couvrir par des tests E2E les fonctionnalités ajoutées depuis le début du projet, notamment la sécurité RBAC, le suivi des présences et la tarification/paiements.

**Durée estimée** : 2 semaines.

**Équipe suggérée** : 1 QA / 1 dev full-stack.

**Definition of Done** :
- Toutes les fonctionnalités livrées depuis le Sprint 1 sont couvertes par des tests E2E.
- Les tests E2E passent en CI sur chaque PR.
- Aucune régression fonctionnelle n'est découverte après merge.
- Les rapports de tests sont archivés et interprétables.

---

## Tâches du sprint

| ID | Titre | Type | Priorité | Complexité |
|---|---|---|---|---|
| S7-01 | Tests E2E RBAC et sécurité | Testing | P0 | L |
| S7-02 | Tests E2E suivi des présences | Testing | P0 | M |
| S7-03 | Tests E2E tarification et paiements | Testing | P0 | M |
| S7-04 | Tests E2E documents (attestations, certificats, exports) | Testing | P1 | M |
| S7-05 | Tests E2E délégation de sessions | Testing | P1 | M |
| S7-06 | Tests E2E sites, salles et planning | Testing | P1 | M |
| S7-07 | Intégration des tests E2E en CI | DevOps | P0 | S |
| S7-08 | Audit de couverture et corrections | Testing | P1 | M |

---

## Détail des tâches

### S7-01 — Tests E2E RBAC et sécurité

**Objectif**
Vérifier que les correctifs de sécurité (Sprint 1 et 2) sont effectifs et qu'aucune régression n'est introduite.

**Scénarios à couvrir**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `rbac-user-write-protected.spec.ts` | `USER` tente de supprimer `Faculty`, `Teacher`, `TrainingSession`, `StudentGroup`, `Participant`, `PositioningTest`, `DiplomaModel` | 403 |
| `rbac-user-audit-log.spec.ts` | `USER` tente d'écrire `AuditLog` | 403 |
| `rbac-user-read-only.spec.ts` | `USER` lit `Training`, `TrainingLevel`, `PaymentReceipt` | 200 |
| `idor-attestation.spec.ts` | `USER` demande attestation d'une autre session | 404 |
| `idor-certificate.spec.ts` | `USER` demande certificat d'une autre session | 404 |
| `idor-positioning.spec.ts` | Saisie note cross-test | 409 |
| `rate-limiting.spec.ts` | 6 échecs de login depuis la même IP | 429 au 6e essai |

**Fichiers à créer / modifier**
- `e2e/rbac-user-write-protected.spec.ts` (nouveau)
- `e2e/rbac-user-audit-log.spec.ts` (nouveau)
- `e2e/idor-documents.spec.ts` (nouveau)
- `e2e/idor-positioning.spec.ts` (nouveau)
- `e2e/rate-limiting.spec.ts` (nouveau)

**Tests existants à maintenir**
- `e2e/journey.spec.ts` (parcours complet)

**Estimation** : 3 jours.

---

### S7-02 — Tests E2E suivi des présences

**Objectif**
Vérifier le workflow complet de suivi des présences (Sprint 4).

**Scénarios à couvrir**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `attendance-basic.spec.ts` | Saisir une présence pour un participant | 201, présence enregistrée |
| `attendance-bulk.spec.ts` | Saisir les présences pour toute une occurrence | Toutes les lignes créées |
| `attendance-justification.spec.ts` | Joindre un justificatif à une absence | Document uploadé, URL enregistrée |
| `attendance-rate.spec.ts` | Vérifier le taux de présence après plusieurs occurrences | Taux correct |
| `attendance-export.spec.ts` | Exporter les présences en CSV/Excel | Fichier téléchargé, données cohérentes |

**Fichiers à créer / modifier**
- `e2e/attendance-basic.spec.ts` (nouveau)
- `e2e/attendance-bulk.spec.ts` (nouveau)
- `e2e/attendance-justification.spec.ts` (nouveau)
- `e2e/attendance-rate.spec.ts` (nouveau)
- `e2e/attendance-export.spec.ts` (nouveau)

**Estimation** : 2 jours.

---

### S7-03 — Tests E2E tarification et paiements

**Objectif**
Vérifier le workflow complet de tarification et de paiements (Sprint 5).

**Scénarios à couvrir**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `pricing-rules.spec.ts` | Créer des règles de tarification par catégorie | Prix appliqués correctement |
| `payment-flow.spec.ts` | Enregistrer un paiement partiel, puis le compléter | Balance à jour après chaque paiement |
| `payment-refund.spec.ts` | Rembourser un paiement | Balance mise à jour, audit tracé |
| `financial-export.spec.ts` | Exporter les paiements d'une session | CSV/Excel cohérents |

**Fichiers à créer / modifier**
- `e2e/pricing-rules.spec.ts` (nouveau)
- `e2e/payment-flow.spec.ts` (nouveau)
- `e2e/payment-refund.spec.ts` (nouveau)
- `e2e/financial-export.spec.ts` (nouveau)

**Estimation** : 2 jours.

---

### S7-04 — Tests E2E documents (attestations, certificats, exports)

**Objectif**
Vérifier la génération et l'export de documents (Sprints 1, 2.2, 4, 5).

**Scénarios à couvrir**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `documents-attestation.spec.ts` | Générer une attestation pour un participant | PDF valide |
| `documents-certificate.spec.ts` | Générer un certificat de réussite | PDF valide |
| `documents-bulk-export.spec.ts` | Exporter toutes les attestations d'une session | ZIP téléchargé |
| `documents-preview.spec.ts` | Prévisualiser un document avant téléchargement | Aperçu PDF affiché |

**Fichiers à créer / modifier**
- `e2e/documents-attestation.spec.ts` (nouveau)
- `e2e/documents-certificate.spec.ts` (nouveau)
- `e2e/documents-bulk-export.spec.ts` (nouveau)
- `e2e/documents-preview.spec.ts` (nouveau)

**Estimation** : 1,5 jour.

---

### S7-05 — Tests E2E délégation de sessions

**Objectif**
Vérifier le workflow de délégation (Sprint 2).

**Scénarios à couvrir**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `delegation-flow.spec.ts` | MANAGER délègue une session à un USER → USER peut inscrire/éditer → MANAGER retire → USER perd l'accès | Transitions correctes, 403 après retrait |
| `delegation-list.spec.ts` | USER voit uniquement les sessions déléguées | Liste filtrée |
| `delegation-audit.spec.ts` | Chaque ajout/retrait de délégation est tracé dans `AuditLog` | AuditLog créé |

**Fichiers à créer / modifier**
- `e2e/delegation-flow.spec.ts` (nouveau)
- `e2e/delegation-list.spec.ts` (nouveau)
- `e2e/delegation-audit.spec.ts` (nouveau)

**Estimation** : 1 jour.

---

### S7-06 — Tests E2E sites, salles et planning

**Objectif**
Vérifier le workflow de sites, salles et planning récurrent (Sprint 3).

**Scénarios à couvrir**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `sites-rooms-crud.spec.ts` | CRUD complet Site/Room | Opérations acceptées/refusées selon RBAC |
| `recurring-schedule.spec.ts` | Créer une session hebdomadaire sur 10 semaines | 10 occurrences générées |
| `room-conflicts.spec.ts` | Générer un planning qui chevauche une salle occupée | Erreur 409 avec détails du conflit |

**Fichiers à créer / modifier**
- `e2e/sites-rooms-crud.spec.ts` (nouveau)
- `e2e/recurring-schedule.spec.ts` (nouveau)
- `e2e/room-conflicts.spec.ts` (nouveau)

**Estimation** : 1 jour.

---

### S7-07 — Intégration des tests E2E en CI

**Solution**
1. Configurer le workflow GitHub Actions (ou CI existante) pour exécuter les tests E2E :
   - Prérequis : base de données de test, seed de données.
   - Commande : `npm run test:e2e` (à créer si inexistant).
   - Rapport : générer un rapport HTML (Playwright) et l'archiver en artifact.
2. Ajouter un statut de vérification sur les PRs : les tests E2E doivent passer pour merger.
3. Configurer un seuil de couverture minimal (ex: 80% des routes API couvertes).

**Fichiers à modifier / créer**
- `.github/workflows/e2e.yml` (nouveau ou mise à jour)
- `package.json` (script `test:e2e`)
- `playwright.config.ts` (si Playwright est utilisé)

**Tests**
- Vérifier que le workflow CI fonctionne sur une PR de test.

**Estimation** : 0,5 jour.

---

### S7-08 — Audit de couverture et corrections

**Solution**
1. Exécuter les tests E2E et générer un rapport de couverture.
2. Identifier les scénarios manquants ou les cas limites non couverts.
3. Ajouter les tests manquants.
4. Corriger les bugs découverts pendant les tests.

**Fichiers à modifier**
- Tous les fichiers `e2e/*.spec.ts`
- Code applicatif si bugs corrigés

**Tests**
- Tous les tests E2E passent.

**Estimation** : 1 jour.

---

## Ordre de traitement recommandé

```
Semaine 1 :
  Jour 1-3 : S7-01 (RBAC/sécurité)
  Jour 4-5 : S7-02 (présences)
  Jour 6-7 : S7-03 (paiements)

Semaine 2 :
  Jour 8 : S7-04 (documents)
  Jour 9 : S7-05 (délégation) + S7-06 (sites/salles)
  Jour 10 : S7-07 (CI) + S7-08 (couverture)
```

## Risques du sprint

| Risque | Mitigation |
|---|---|
| Tests E2E instables (flaky) | Ajouter des retry et des attentes explicites (`waitFor`). |
| Base de test non représentative | Utiliser un seed réaliste avec plusieurs rôles, sessions et inscriptions. |
| CI trop lente | Exécuter les tests E2E en parallèle ou par groupes. |

## Livrables

1. `e2e/` complété avec tous les scénarios de régression.
2. `playwright.config.ts` / configuration Cypress à jour.
3. Workflow CI pour les tests E2E.
4. Rapport de couverture des tests E2E.
5. `docs/decisions.md` mis à jour avec les choix de ce sprint.
