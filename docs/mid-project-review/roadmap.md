# Roadmap de finalisation — CEIL

## Principes directeurs

* Évolution incrémentale, **pas de réécriture complète**.
* Sécurité et cohérence métier corrigées en premier.
* Les fonctionnalités métier essentielles à un CEIL opérationnel viennent ensuite.
* La qualité, les tests et la production readiness suivent.
* Chaque phase produit une version déployable/testable.

---

## Phase 1 — Critical Fixes

**Objectif** : sécuriser l'application et corriger les incohérences bloquantes.
**Durée estimée** : 2 semaines.

| ID | Tâche | Dépendances | Priorité | Complexité | Module impacté |
|---|---|---|---|---|---|
| CF-001 | Restreindre le rôle `USER` (lecture + saisie ciblée uniquement) | - | P0 | Moyenne | `rbac.ts`, handlers |
| CF-002 | Corriger `canWrite` sur `AuditLog` (interdire à USER) | CF-001 | P0 | Faible | `rbac.ts` |
| CF-003 | Corriger l'IDOR sur `/api/sessions/[id]/attestation` et `/certificates` | - | P0 | Faible | Route handlers |
| CF-004 | Rendre l'audit transactionnel (logAudit dans `withTransaction`) | - | P0 | Moyenne | `enrollment.ts`, `locking.ts`, `groups.ts` ... |
| CF-005 | Clarifier le modèle session (supprimer `trainingLevelId` si multi-niveaux confirmé) | - | P0 | Élevée | Schéma + services |
| CF-006 | Internationaliser tous les textes en dur du workspace | - | P0 | Moyenne | `messages/`, workspace tabs |
| CF-007 | Corriger l'import de notes de positionnement (créer lignes manquantes) | - | P0 | Moyenne | `imports.ts`, `positioning.ts` |
| CF-008 | Vérifier `enrollmentId` appartient au `positioningTestId` | - | P0 | Moyenne | `positioning.ts` |
| CF-009 | Ajouter rate limiting login (reverse proxy ou middleware) | - | P0 | Moyenne | Infra / middleware |
| CF-010 | Renforcer complexité mot de passe | - | P2 | Faible | `schemas.ts` |

## Phase 2 — Core Business

**Objectif** : ajouter les fonctionnalités métier indispensables à un CEIL opérationnel.
**Durée estimée** : 4 semaines.

| ID | Tâche | Dépendances | Priorité | Complexité | Module impacté |
|---|---|---|---|---|---|
| CB-001 | Ajouter entités `Site` et `Room` | CF-005 | P0 | Moyenne | Prisma, API, UI |
| CB-002 | Ajouter `ScheduleEntry` (planning récurrent) | CB-001 | P0 | Élevée | Prisma, services groupes, UI |
| CB-003 | Détecter les conflits enseignant/salle | CB-002 | P0 | Élevée | Services, validation |
| CB-004 | Ajouter `Attendance` (présences/absences/retards) | CB-002 | P0 | Élevée | Prisma, services, workspace |
| CB-005 | Calculer le taux d'assiduité et l'impact certification | CB-004 | P1 | Moyenne | `derive.ts`, documents |
| CB-006 | Ajouter `Pricing` par formation/niveau/catégorie | - | P0 | Élevée | Prisma, services, UI |
| CB-007 | Ajouter `PaymentReceipt.enrollmentId` et calculer solde | CB-006 | P1 | Moyenne | Prisma, services |
| CB-008 | Ajouter modes de paiement et états CANCELLED/REFUNDED | CB-006 | P1 | Moyenne | Schéma, services |
| CB-009 | Ajouter `Enrollment.status` et `EnrollmentStatusLog` | - | P1 | Moyenne | Prisma, services |
| CB-010 | Workflow réinscription ancien participant | CB-009 | P1 | Moyenne | Services, UI |
| CB-011 | Export Excel des listes de résultats, groupes, paiements | - | P1 | Moyenne | `exports.ts`, UI |
| CB-012 | Soft-delete généralisé sur entités métier | CF-004 | P1 | Élevée | Schéma + tous les services |

## Phase 3 — UX

**Objectif** : améliorer l'expérience utilisateur et finaliser l'internationalisation.
**Durée estimée** : 2 semaines.

| ID | Tâche | Dépendances | Priorité | Complexité | Module impacté |
|---|---|---|---|---|---|
| UX-001 | Remplacer `window.confirm` par des dialogues shadcn | CF-006 | P1 | Moyenne | `ResourceManager`, `enrollments-tab` |
| UX-002 | Ajouter conteneur scrollable aux grilles éditables | - | P1 | Faible | `editable-grid.tsx` |
| UX-003 | Ajouter aperçu PDF des attestations | - | P1 | Élevée | Documents, UI |
| UX-004 | Refondre la page de vérification publique | CF-003 | P1 | Moyenne | `verify/` |
| UX-005 | Quick actions dashboard | - | P2 | Faible | Dashboard |
| UX-006 | Assistant de configuration gabarit ODT | - | P2 | Moyenne | Diplôme model UI |
| UX-007 | Recherche asynchrone participants | - | P2 | Moyenne | UI inscriptions, paiements |

## Phase 4 — Quality

**Objectif** : renforcer la qualité, la testabilité et la documentation.
**Durée estimée** : 2 semaines.

| ID | Tâche | Dépendances | Priorité | Complexité | Module impacté |
|---|---|---|---|---|---|
| QA-001 | Tests E2E absences + planning + tarification | CB-004, CB-006 | P0 | Élevée | `e2e/` |
| QA-002 | Tests E2E IDOR documents + RBAC USER | CF-001, CF-003 | P0 | Moyenne | `e2e/` |
| QA-003 | Tests d'intégration race conditions groupes | CB-003 | P1 | Moyenne | `tests/integration/` |
| QA-004 | Tests d'accessibilité avec axe-core | - | P2 | Moyenne | `e2e/` |
| QA-005 | Couverture de code et mutation testing | - | P2 | Moyenne | Vitest |
| QA-006 | Documentation API complète (OpenAPI ou markdown) | - | P2 | Moyenne | `docs/` |
| QA-007 | Documentation règles métier et RBAC | - | P2 | Faible | `docs/` |
| QA-008 | Nettoyage `papaparse` et code mort | - | P3 | Faible | `package.json`, source |

## Phase 5 — Production

**Objectif** : préparer l'application à un déploiement fiable.
**Durée estimée** : 1–2 semaines.

| ID | Tâche | Dépendances | Priorité | Complexité | Module impacté |
|---|---|---|---|---|---|
| PROD-001 | CI/CD avec exécution PostgreSQL | QA-001 | P1 | Élevée | `.github/workflows` ou équivalent |
| PROD-002 | Monitoring / métriques / alerting | - | P1 | Moyenne | Infra, health checks |
| PROD-003 | Test de restauration backup | - | P1 | Faible | Procédure |
| PROD-004 | Sécuriser uploads (limite taille, hash nom fichier) | - | P2 | Moyenne | API logos/template |
| PROD-005 | Journalisation structurée et centralisée | - | P2 | Moyenne | `lib/logger` |
| PROD-006 | Vue rapports et KPI financiers | CB-006 | P1 | Moyenne | Dashboard/rapports |

## Phase 6 — Advanced Features

**Objectif** : fonctionnalités secondaires et évolutions.
**Durée estimée** : post-production, itératif.

| ID | Tâche | Dépendances | Priorité | Complexité | Module impacté |
|---|---|---|---|---|---|
| ADV-001 | Notifications email / internes | - | P2 | Moyenne | `Notification`, SMTP |
| ADV-002 | Contrôle continu | - | P2 | Élevée | Schéma, UI notes |
| ADV-003 | Détection/fusion doublons participants | - | P2 | Moyenne | UI participants |
| ADV-004 | Portail apprenant | ADV-001 | P3 | Élevée | Auth, UI publique |
| ADV-005 | Paiement en ligne | - | P3 | Très élevée | Intégration bancaire |
| ADV-006 | Signatures électroniques | - | P3 | Très élevée | Documents, PKI |

---

## Planning synthétique

```text
Semaines  1-2   3-6    7-8    9-10   11-12   13+
Phase     │ CF │  CB  │  UX  │  QA  │ PROD  │ ADV │
```

* **CF** : Critical Fixes — 2 sem.
* **CB** : Core Business — 4 sem.
* **UX** : UX — 2 sem.
* **QA** : Quality — 2 sem.
* **PROD** : Production — 1–2 sem.
* **ADV** : Advanced — itératif.

**Total estimé vers production-ready** : **9 à 10 semaines**.
