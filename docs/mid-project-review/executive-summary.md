# Executive Summary — Audit CEIL

## 1. État actuel en une phrase

L'application CEIL dispose d'une **architecture technique solide** (Next.js 15, Prisma, PostgreSQL, RBAC serveur, tests e2e) et couvre **le cycle métier principal** du CEIL (inscription → test de positionnement → groupes → délibération → documents officiels). Cependant, plusieurs **fonctionnalités métier essentielles sont absentes**, des **incohérences fonctionnelles** subsistent, et quelques **risques de sécurité et de qualité** doivent être résolus avant une mise en production réelle.

## 2. Verdict global

| Critère | Évaluation | Score pondéré |
|---|---|---|
| Cohérence technique | Bien | 7 / 10 |
| Couverture fonctionnelle métier | Moyenne — cycle principal OK, opérations quotidiennes incomplètes | 5 / 10 |
| Sécurité | Moyenne — RBAC présent mais lacunes importantes | 5 / 10 |
| UX / accessibilité | Moyenne — ergonomie globale correcte, i18n partielle | 5 / 10 |
| Qualité / maintenabilité | Bien — architecture claire, conventions, tests | 7 / 10 |
| Production readiness (logs, monitoring, backups, perf) | Moyenne-faible | 4 / 10 |

### Production Readiness

```text
Production Readiness: 55/100
```

**Justification** : l'application est fonctionnellement utilisable en interne pour un cycle de formation complet, mais elle manque de briques essentielles pour une production fiable :

* absence de gestion des salles, absences, emploi du temps, tarification, notifications, historique des documents émis ;
* risques de sécurité sur les endpoints de documents (IDOR), rôle `USER` trop permissif en écriture, pas de rate limiting ;
* pas de soft-delete ni de purge/politique d'audit ;
* internationalisation incomplète dans le workspace ;
* monitoring/observabilité opérationnelle non visible dans le code.

## 3. Ce qui est déjà solide

* **Architecture en couches propre** : services métier, API, validation Zod, dérivés purs — cohérent et testable.
* **Modèle de données normalisé** : peu de redondances, CUID partout, timestamps, soft-disable via `disabled`.
* **Cycle métier couvert de bout en bout** : inscription → positionnement → groupes → délibération → documents.
* **RBAC systématique côté serveur** : chaque route vérifie le rôle, indépendamment de l'UI.
* **Gestion des documents officiels** : impression A4, gabarit ODT téléversable, vérification publique.
* **Tests automatisés** : 300 tests unitaires/intégration (annoncés), 51 tests e2e (annoncés), parcours complet.
* **Imports Excel/CSV robustes** : rapport d'import détaillé, gestion des dates ambiguës, homonymes de colonnes.
* **Grille éditable performante** : navigation clavier, collage Excel, calculs en direct.

## 4. Problèmes critiques

1. **Rôle `USER` excessif** : peut supprimer/modifier presque toutes les ressources métier (uniquement lecture seule sur `Training`, `TrainingLevel`, `PaymentReceipt`).
2. **Incohérence session mono vs multi-niveaux** : `TrainingSession.trainingLevelId` existe alors que le métier et le code affirment que la session est multi-niveaux.
3. **Absence de salle, emploi du temps et absences** : empêche la planification réelle des groupes et le suivi pédagogique.
4. **IDOR sur les documents** (`/api/sessions/[id]/attestation`, `/certificates`) : le paramètre `enrollmentId` n'est pas vérifié contre la session.
5. **Audit non transactionnel / partiel** : `removeEnrollment`, `assignGroup`, verrouillage/déverrouillage loguent sans transaction.
6. **Import de notes de positionnement limité** : impossible de créer de nouvelles notes via l'import.
7. **Internationalisation incomplète** : de nombreux textes du workspace sont en dur en français, y compris en mode arabe.
8. **Pas de soft-delete** : suppression définitive avec CASCADE sur plusieurs entités critiques.

## 5. Fonctionnalités métier manquantes majeures

* Gestion des **salles / sites** et des **conflits** de planning.
* Suivi des **absences / présences** et taux d'assiduité.
* Module de **tarification** par formation/niveau/catégorie et suivi des **impayés / soldes**.
* **Historique des documents émis** (certificats, attestations, PV).
* **Notifications** (email, relances, rappels).
* **Contrôle continu** (notes intermédiaires).
* **Statuts d'inscription** (pré-inscrit, confirmé, annulé).
* **Export Excel** des listes de résultats, groupes, paiements.
* **Tableau de bord enrichi** (taux de présence, recettes, statistiques par niveau/langue).
* **Gestion des remboursements / annulations de reçus**.

## 6. Chemin le plus court vers une version production-ready

### Phase 1 — Sécurité et corrections critiques (2 semaines)

* Restreindre le rôle `USER` (lecture seule ou permissions ciblées).
* Corriger l'IDOR sur les endpoints de documents.
* Ajouter la vérification cross-test pour `upsertPositioningScore`.
* Internationaliser le workspace (minimum fr/ar).
* Corriger l'audit non transactionnel.

### Phase 2 — Fonctionnalités cœur manquantes (3–4 semaines)

* Ajouter `Room`/`Site` et gérer la capacité des groupes avec validation.
* Implémenter `Attendance` (séances + présences/absences/retards) comme base du suivi pédagogique.
* Module de tarification minimal (`Pricing`) et solde de paiement par inscription.
* Statuts d'inscription et workflow annulation/transfert.

### Phase 3 — Qualité production (2–3 semaines)

* Soft-delete généralisé sur les entités métier.
* Audit enrichi (actions normalisées, IP, TTL/purge).
* Tests E2E critiques absences/tarification.
* Monitoring et health checks renforcés.

## 7. Conclusion attendue — réponses aux 12 questions

1. **Qu'est-ce qui est déjà solide ?**
   Architecture, modèle de données, cycle métier principal, RBAC serveur, grille éditable, documents officiels, import/export.

2. **Qu'est-ce qui doit absolument être corrigé ?**
   Permissions `USER` trop larges, IDOR documents, audit non transactionnel, incohérence session mono/multi-niveaux, i18n workspace.

3. **Quelles fonctionnalités métier sont manquantes ?**
   Salles/planning, absences, tarification, historique documents, notifications, contrôle continu, statuts d'inscription, exports.

4. **Quelles règles métier doivent être ajoutées ?**
   Voir [`business-rules.md`](./business-rules.md) ; points clés : barèmes validés, capacité groupes non dépassée, conflits prof/salle, taux d'assiduité minimal pour certification.

5. **Quels NFR sont manquants ?**
   Voir [`non-functional-requirements.md`](./non-functional-requirements.md) ; performance cible, rate limiting, backup automatisé, monitoring, accessibilité complète, RTL documents.

6. **Quels problèmes de sécurité existent ?**
   Voir [`security-review.md`](./security-review.md) ; principaux : IDOR, rôle USER excessif, pas de rate limiting login, pas de soft-delete, audit incomplete.

7. **Quels problèmes UX doivent être corrigés ?**
   Voir [`ux-review.md`](./ux-review.md) ; principaux : textes en dur non traduits, confirmation avant suppression en masse, aperçu PDF inexistant, RTL documents.

8. **Quels changements de base de données sont nécessaires ?**
   Voir [`architecture-review.md`](./architecture-review.md) ; ajout de `Room`, `Site`, `Attendance`, `Pricing`, `GeneratedDocument`, statuts, suppression de `TrainingSession.trainingLevelId` si multi-niveaux.

9. **Quels tests sont indispensables ?**
   Voir [`testing-review.md`](./testing-review.md) ; E2E pour le cycle complet, absences, tarification, RBAC, génération de documents.

10. **Quelles fonctionnalités peuvent attendre ?**
    Notifications push, apprenant portal self-service, statistiques avancées, intégration bancaire, signatures électroniques.

11. **Quel est le chemin le plus court vers une version production-ready ?**
    Phase sécurité (2 semaines) + fonctionnalités cœur (4 semaines) + qualité production (3 semaines) ≈ 9 semaines.

12. **Quel backlog dois-je exécuter ensuite ?**
    Voir [`prioritized-backlog.md`](./prioritized-backlog.md).
