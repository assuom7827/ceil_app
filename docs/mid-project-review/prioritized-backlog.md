# Backlog priorisé — CEIL

## Légende des types

* `Feature` : nouvelle fonctionnalité.
* `Enhancement` : amélioration d'une fonctionnalité existante.
* `Bug` : correction d'un défaut.
* `Refactoring` : amélioration interne sans changement fonctionnel.
* `Security` : renforcement de la sécurité.
* `Performance` : amélioration des performances.
* `UX` : amélioration de l'expérience utilisateur.
* `Documentation` : documentation.
* `Testing` : tests.

## Légende de la complexité

* `S` — Small (< 1 jour)
* `M` — Medium (1–3 jours)
* `L` — Large (3–5 jours)
* `XL` — Extra large (> 5 jours)

## Backlog

| ID | Epic | User Story / Task | Type | Priorité | Complexité | Dépendances |
|---|---|---|---|---|---|---|
| BL-001 | Sécurité | Restreindre le rôle USER et empêcher l'écriture d'AuditLog | Security | P0 | M | - |
| BL-002 | Sécurité | Corriger l'IDOR sur les endpoints d'attestation et de certificats | Security | P0 | S | - |
| BL-003 | Sécurité | Ajouter le rate limiting au login | Security | P0 | M | - |
| BL-004 | Audit | Rendre l'audit transactionnel pour toutes les opérations d'écriture | Enhancement | P0 | M | - |
| BL-005 | Modèle de données | Clarifier la session mono vs multi-niveaux (supprimer `trainingLevelId` si multi) | Refactoring | P0 | L | - |
| BL-006 | I18n | Traduire tous les textes en dur du workspace en arabe | UX | P0 | M | - |
| BL-007 | Positionnement | Corriger l'import de notes pour créer les lignes manquantes | Bug | P0 | M | - |
| BL-008 | Positionnement | Vérifier que l'inscription appartient bien au test lors de la saisie des notes | Security | P0 | M | - |
| BL-009 | Groupes | Ajouter les entités Site et Room | Feature | P0 | M | BL-005 |
| BL-010 | Groupes | Créer le planning récurrent (ScheduleEntry) et détecter les conflits | Feature | P0 | XL | BL-009 |
| BL-011 | Présence | Implémenter le suivi des présences/absences/retards | Feature | P0 | XL | BL-010 |
| BL-012 | Présence | Calculer le taux d'assiduité et son impact sur la certification | Feature | P1 | M | BL-011 |
| BL-013 | Paiements | Ajouter les tarifs (Pricing) par formation/niveau/catégorie | Feature | P0 | XL | - |
| BL-014 | Paiements | Lier les reçus aux inscriptions et calculer les soldes | Feature | P1 | M | BL-013 |
| BL-015 | Paiements | Ajouter modes de paiement et états annulé/remboursé | Feature | P1 | M | BL-013 |
| BL-016 | Inscriptions | Ajouter les statuts d'inscription et leur historique | Feature | P1 | M | - |
| BL-017 | Inscriptions | Workflow de réinscription d'un ancien participant au niveau supérieur | Feature | P1 | M | BL-016 |
| BL-018 | Export | Exporter les listes, résultats et paiements en Excel/CSV | Feature | P1 | M | - |
| BL-019 | Documents | Tracer l'émission de chaque document officiel | Feature | P1 | M | - |
| BL-020 | Documents | Refondre la vérification publique d'authenticité | Security | P1 | M | BL-019 |
| BL-021 | Données | Implémenter le soft-delete généralisé | Feature | P1 | XL | BL-004 |
| BL-022 | Validation | Renforcer la complexité des mots de passe | Security | P2 | S | - |
| BL-023 | Validation | Limiter le max des notes au barème réel | Enhancement | P2 | S | - |
| BL-024 | UX | Ajouter un dialogue de confirmation pour les suppressions en masse | UX | P1 | M | BL-006 |
| BL-025 | UX | Ajouter un conteneur scrollable aux grilles éditables | UX | P1 | S | - |
| BL-026 | UX | Ajouter un aperçu PDF avant téléchargement des attestations | UX | P1 | L | - |
| BL-027 | UX | Quick actions sur le dashboard | UX | P2 | S | - |
| BL-028 | Notifications | Système de notifications internes et relances email | Feature | P2 | L | BL-016, BL-013 |
| BL-029 | Tests | Tests E2E du cycle complet incluant absences et tarification | Testing | P0 | XL | BL-010, BL-011, BL-013 |
| BL-030 | Tests | Tests E2E de sécurité (IDOR, RBAC USER) | Testing | P0 | M | BL-001, BL-002 |
| BL-031 | Tests | Tests d'intégration des race conditions groupes | Testing | P1 | M | BL-010 |
| BL-032 | Tests | Tests d'accessibilité avec axe-core | Testing | P2 | M | BL-006 |
| BL-033 | Production | CI/CD avec exécution PostgreSQL | Feature | P1 | L | BL-029, BL-030 |
| BL-034 | Production | Monitoring / alerting applicatif | Feature | P1 | M | BL-033 |
| BL-035 | Production | Procédure de backup/restore testée | Documentation | P1 | S | - |
| BL-036 | Performance | Optimiser les requêtes dashboard et ajouter cache référentiels | Performance | P2 | M | - |
| BL-037 | Advanced | Contrôle continu (notes intermédiaires) | Feature | P2 | XL | - |
| BL-038 | Advanced | Détection et fusion de doublons participants | Feature | P2 | M | - |
| BL-039 | Future | Portail apprenant self-service | Feature | P3 | XL | BL-028 |
| BL-040 | Future | Paiement en ligne | Feature | P3 | XL | BL-013 |

## Sprints suggérés

### Sprint 1 (Sécurité & cohérence)

BL-001, BL-002, BL-003, BL-004, BL-008, BL-022

### Sprint 2 (Modèle & inscriptions)

BL-005, BL-007, BL-016, BL-017, BL-021

### Sprint 3 (Salles & planning)

BL-009, BL-010

### Sprint 4 (Présences & tarification)

BL-011, BL-012, BL-013, BL-014

### Sprint 5 (Paiements & documents)

BL-015, BL-018, BL-019, BL-020

### Sprint 6 (UX & i18n)

BL-006, BL-024, BL-025, BL-026, BL-027

### Sprint 7 (Tests & qualité)

BL-029, BL-030, BL-031, BL-032, BL-023

### Sprint 8 (Production)

BL-033, BL-034, BL-035, BL-036

## Répartition par priorité

| Priorité | Nombre d'items |
|---|---|
| P0 | 15 |
| P1 | 14 |
| P2 | 9 |
| P3 | 2 |

## Répartition par type

| Type | Nombre |
|---|---|
| Feature | 19 |
| Security | 6 |
| Testing | 4 |
| UX | 6 |
| Enhancement | 4 |
| Refactoring | 1 |
| Documentation | 1 |
| Performance | 1 |
