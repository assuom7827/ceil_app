# Production Readiness — CEIL

## 1. Score global

```text
Production Readiness: 55/100
```

## 2. Critères détaillés

| Domaine | Score /10 | Justification |
|---|---|---|
| **Fonctionnalités métier** | 5 / 10 | Cycle principal OK ; manquent absences, salles, planning, tarification, notifications, exports. |
| **Sécurité** | 5 / 10 | RBAC de base, mais USER trop permissif, IDOR documents, pas de rate limiting, audit partiel. |
| **Qualité du code** | 7 / 10 | Architecture claire, conventions, typage strict, tests présents. Dette mineure (typage CRUD unknown, dates). |
| **Base de données** | 6 / 10 | Modèle solide mais incohérence niveau/session, pas de soft-delete, entités clés absentes. |
| **UX / Accessibilité** | 5 / 10 | Ergonomie globale correcte, i18n incomplète, a11y partielle. |
| **Tests** | 6 / 10 | Bonne couverture fonctionnelle, manquent sécurité, perf, a11y, absences, tarification. |
| **Observabilité / Monitoring** | 3 / 10 | Health checks présents, mais pas de métriques, alerting, tracing dans le code. |
| **Backup / Restore / DR** | 5 / 10 | Scripts systemd et logrotate documentés. Pas de vérification de restauration automatisée visible. |
| **Documentation** | 7 / 10 | README, architecture, decisions, exploitation complets. API et règles métier méritent plus de détail. |
| **Déploiement** | 6 / 10 | Docker Compose, scripts Next.js, reverse proxy documentés. Pas de CI/CD visible dans le repo. |

## 3. Points bloquants pour la production

Avant toute mise en production, les éléments suivants doivent être traités :

### 3.1 Sécurité

* [ ] **Corriger l'IDOR** sur les endpoints `/api/sessions/[id]/attestation` et `/certificates`.
* [ ] **Restreindre le rôle `USER`** pour qu'il ne puisse plus supprimer/modifier des ressources critiques.
* [ ] **Empêcher `USER`** d'écrire dans `AuditLog`.
* [ ] **Ajouter le rate limiting** au login (reverse proxy ou middleware).
* [ ] **Renforcer la complexité des mots de passe**.
* [ ] **Sécuriser la vérification publique** (token opaque, minimum de PII).

### 3.2 Données / intégrité

* [ ] **Clarifier le modèle session** (mono vs multi-niveaux).
* [ ] **Ajouter le soft-delete** sur les entités métier critiques.
* [ ] **Ajouter `Room`, `Site`, `ScheduleEntry`, `Attendance`, `Pricing`, `GeneratedDocument`, `EnrollmentStatusLog`**.
* [ ] **Audit transactionnel** : inclure `logAudit` dans les transactions.
* [ ] **Contraintes** : `minimumPoints < maximumPoints`, `dateFrom <= dateTo`, `amount > 0`, `@@unique([trainingSessionId, groupType, name])`.

### 3.3 Métier

* [ ] **Gestion des présences/absences**.
* [ ] **Tarification et suivi des soldes**.
* [ ] **Statuts d'inscription** (pré-inscrit, confirmé, annulé, transféré).
* [ ] **Export Excel** des listes et résultats.
* [ ] **Historique des documents émis**.

### 3.4 UX / i18n

* [ ] **Traduire l'intégralité du workspace** en arabe.
* [ ] **Aperçu PDF** avant téléchargement des attestations.
* [ ] **Dialogue de confirmation** pour les suppressions en masse.
* [ ] **Corriger le RTL** des documents bilingues.

### 3.5 Opérations

* [ ] **Monitoring et alerting** (métriques, erreurs, health).
* [ ] **CI/CD** : tests obligatoires avant déploiement.
* [ ] **Test de restauration** des backups validé.
* [ ] **Documentation runbook** pour les incidents.

## 4. Ce qui est déjà prêt pour la production

* Architecture technique stable et moderne.
* Cycle métier principal testé de bout en bout.
* Gestion des erreurs et RBAC de base.
* Documentation de démarrage, exploitation, reverse proxy.
* Health checks et scripts de backup systemd.

## 5. Échéancier estimé vers une production-ready

| Phase | Durée estimée | Livrables clés |
|---|---|---|
| Phase 1 — Sécurité & corrections critiques | 2 semaines | RBAC corrigé, IDOR corrigé, i18n workspace, audit transactionnel. |
| Phase 2 — Fonctionnalités cœur | 4 semaines | Salles/planning, absences, tarification, statuts inscription, documents émis. |
| Phase 3 — Qualité production | 3 semaines | Soft-delete, tests E2E critiques, monitoring, CI/CD, runbook. |
| **Total** | **≈ 9 semaines** | Version production-ready. |

## 6. Risques de mise en production actuelle

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Manipulation de documents d'autrui via IDOR | Élevée | Élevée | Corriger avant prod. |
| Suppression accidentelle de données par USER | Élevée | Élevée | Restreindre USER + soft-delete. |
| Perte de données par suppression dure | Moyenne | Élevée | Soft-delete + backups. |
| Incohérence niveau/session | Moyenne | Moyenne | Décision métier + migration. |
| Impossibilité de planifier les groupes | Élevée | Élevée | Ajouter Room/ScheduleEntry. |
| Impossibilité de suivre les finances | Élevée | Élevée | Ajouter Pricing. |
| Impossibilité de suivre l'assiduité | Élevée | Élevée | Ajouter Attendance. |

## 7. Checklist de lancement

* [ ] Tous les problèmes P0 résolus.
* [ ] Tests E2E complets (cycle + absences + tarification + sécurité) passent.
* [ ] Migration et seed fonctionnent sur environnement de staging.
* [ ] Backups automatiques configurés et testés.
* [ ] Reverse proxy et rate limiting en place.
* [ ] Monitoring et alertes actifs.
* [ ] Documentation d'exploitation à jour.
* [ ] Formation des utilisateurs clés réalisée.
