# Exigences fonctionnelles proposées — CEIL

## Format

```text
FR-XXX — Titre
  Description
  Acteur(s)
  Préconditions
  Workflow
  Règles métier
  Données
  Résultat attendu
  Exceptions
  Priorité
```

## FR-001 — Gestion des comptes utilisateurs

* **Description** : Créer, modifier, désactiver et supprimer des comptes utilisateurs avec rôles ADMIN, MANAGER, USER.
* **Acteurs** : ADMIN (CRUD), MANAGER (lecture), USER (lecture seule).
* **Préconditions** : Être authentifié avec le rôle approprié.
* **Workflow** : ADMIN accède à `/users`, crée/modifie un compte. Les règles de garde empêchent le dernier ADMIN de se supprimer/désactiver.
* **Règles métier** : BR-016, BR-017, BR-018, BR-019.
* **Données** : `User` (email, name, role, active, passwordHash).
* **Résultat attendu** : Compte utilisable immédiatement ; compte désactivé rejeté lors de la prochaine requête.
* **Exceptions** : Email dupliqué (409), tentative de suppression du dernier ADMIN (403).
* **Priorité** : P1.

## FR-002 — Gestion des apprenants

* **Description** : CRUD des participants avec état civil, faculté, catégories et historique.
* **Acteurs** : MANAGER, USER (lecture pour certains champs selon RBAC).
* **Préconditions** : Authentifié.
* **Workflow** : Création via `/participants` ou à la volée lors de l'inscription.
* **Règles métier** : BR-001, BR-020, BR-021.
* **Données** : `Participant`, `Faculty`, `StudentCategory`.
* **Résultat attendu** : Participant identifiable, sans doublon, avec historique accessible.
* **Exceptions** : Matricule dupliqué, suppression impossible si inscriptions/paiements (409).
* **Priorité** : P0.

## FR-003 — Gestion des langues et formations

* **Description** : CRUD des formations linguistiques (langue + niveaux CECRL associés).
* **Acteurs** : MANAGER (écriture), USER (lecture seule).
* **Préconditions** : Authentifié.
* **Workflow** : Définir une formation, lui associer des niveaux.
* **Règles métier** : BR-024.
* **Données** : `Training`, `TrainingLevel`.
* **Résultat attendu** : Catalogue cohérent, sans chevauchement de niveaux.
* **Exceptions** : Niveaux qui se chevauchent (400), suppression impossible si sessions existent (409).
* **Priorité** : P0.

## FR-004 — Gestion des sessions de formation

* **Description** : CRUD des sessions annuelles par formation, avec dates, seuil d'admission, modèle de diplôme.
* **Acteurs** : MANAGER (écriture), USER (lecture seule).
* **Préconditions** : Formation existante.
* **Workflow** : Créer session → configurer seuil → ouvrir inscriptions.
* **Règles métier** : BR-022, BR-023.
* **Données** : `TrainingSession`, `Training`, `DiplomaModel`.
* **Résultat attendu** : Session mono ou multi-niveaux bien définie.
* **Exceptions** : Dates inversées (400), suppression si inscriptions existent (409).
* **Priorité** : P0.

## FR-005 — Test de positionnement

* **Description** : Créer un test, saisir/corriger les notes E.E/C.E, importer en masse, attribuer le niveau résolu.
* **Acteurs** : MANAGER, USER (saisie selon RBAC).
* **Préconditions** : Formation et session existantes.
* **Workflow** : Créer test → inscrire participants au test → saisir notes → déterminer niveaux → écrire `assignedLevel`.
* **Règles métier** : BR-005, BR-006, BR-025, BR-026, BR-027, BR-028.
* **Données** : `PositioningTest`, `PositioningScore`, `Enrollment`.
* **Résultat attendu** : Chaque nouvel inscrit obtient un niveau ; les anciens peuvent être orientés au niveau suivant.
* **Exceptions** : Test verrouillé (409), notes hors barème (400), participant non inscrit au test (404).
* **Priorité** : P0.

## FR-006 — Inscriptions

* **Description** : Inscrire des participants existants ou nouveaux à une session, gérer les statuts, annuler/transférer.
* **Acteurs** : MANAGER, USER.
* **Préconditions** : Session ouverte.
* **Workflow** : Recherche multi-sélection ou création → `enroll()` → affectation groupe → paiement → confirmation.
* **Règles métier** : BR-002, BR-003, BR-013, BR-025, BR-026, BR-029, BR-030, BR-031.
* **Données** : `Enrollment`, `Participant`, `TrainingSession`, `StudentGroup`.
* **Résultat attendu** : Inscription confirmée avec statut traçable.
* **Exceptions** : Doublon (409), session verrouillée (409), capacité dépassée (409 si vérifié).
* **Priorité** : P0.

## FR-007 — Groupes et planning

* **Description** : Créer des groupes par niveau, gérer capacité, enseignant, salles, horaires, conflits.
* **Acteurs** : MANAGER, USER (lecture).
* **Préconditions** : Session et inscriptions avec niveaux.
* **Workflow** : Organiser groupes par niveau → assigner enseignants → assigner salles → définir horaires → vérifier conflits.
* **Règles métier** : BR-032, BR-033, BR-034, BR-035.
* **Données** : `StudentGroup`, `Teacher`, `Room`, `Site`, `ScheduleEntry`.
* **Résultat attendu** : Groupes planifiés sans conflits, respect des capacités.
* **Exceptions** : Capacité dépassée (409), conflit prof/salle (409).
* **Priorité** : P0.

## FR-008 — Gestion des salles et sites

* **Description** : Référentiel des sites et salles avec capacité.
* **Acteurs** : MANAGER (écriture), USER (lecture).
* **Préconditions** : Authentifié.
* **Workflow** : CRUD sites/salles.
* **Règles métier** : BR-034.
* **Données** : `Site`, `Room`.
* **Résultat attendu** : Salles disponibles pour le planning.
* **Exceptions** : Salle utilisée dans un groupe (409).
* **Priorité** : P0.

## FR-009 — Présences et absences

* **Description** : Enregistrer la présence/absence/retard par séance, calculer le taux d'assiduité.
* **Acteurs** : Enseignant (saisie), MANAGER (lecture).
* **Préconditions** : Groupes et séances créés.
* **Workflow** : Séance → appel → justification éventuelle.
* **Règles métier** : BR-036, BR-037, BR-038.
* **Données** : `ScheduleEntry`, `Attendance`.
* **Résultat attendu** : Suivi fiable de l'assiduité.
* **Exceptions** : Séance verrouillée (409).
* **Priorité** : P0.

## FR-010 — Délibération et résultats

* **Description** : Saisir les 4 notes finales (E.O, E.E, C.O, C.E), calculer total, statut, admis/ajourné.
* **Acteurs** : MANAGER, USER.
* **Préconditions** : Session ouverte, notes de positionnement éventuelles.
* **Workflow** : Saisie grille → import éventuel → recalcul → verrouillage.
* **Règles métier** : BR-007, BR-008, BR-009, BR-039.
* **Données** : `DeliberationEntry`, `TrainingSession`.
* **Résultat attendu** : Liste des admis/ajournés/non délibérés.
* **Exceptions** : Session verrouillée (409), notes hors barème (400).
* **Priorité** : P0.

## FR-011 — Paiements et tarification

* **Description** : Définir les tarifs par formation/niveau/catégorie, enregistrer les reçus, calculer les soldes.
* **Acteurs** : MANAGER (écriture), USER (saisie restreinte).
* **Préconditions** : Inscription existante.
* **Workflow** : Tarif → reçu → confirmation → solde.
* **Règles métier** : BR-041, BR-042, BR-043, BR-044.
* **Données** : `Pricing`, `PaymentReceipt`, `Enrollment`.
* **Résultat attendu** : Suivi financier complet par session/inscription.
* **Exceptions** : Montant invalide (400), reçu déjà confirmé (409).
* **Priorité** : P0.

## FR-012 — Documents officiels

* **Description** : Générer PV, diplômes, attestations, listes d'émargement, attestation de réussite PDF, et tracer les émissions.
* **Acteurs** : MANAGER.
* **Préconditions** : Session, notes, groupes.
* **Workflow** : Sélectionner document → générer → archiver → télécharger/imprimer.
* **Règles métier** : BR-011, BR-045, BR-046, BR-047.
* **Données** : `GeneratedDocument`, `DiplomaModel`, `DocumentTemplate`.
* **Résultat attendu** : Documents conformes, numérotés, traçables.
* **Exceptions** : Attestation d'un ajourné (422), modèle absent (503).
* **Priorité** : P0.

## FR-013 — Vérification publique d'authenticité

* **Description** : Permettre à un tiers de vérifier l'authenticité d'une attestation via URL/QR code sans exposer de données sensibles.
* **Acteurs** : Public (lecture).
* **Préconditions** : Attestation émise.
* **Workflow** : Scan QR → page `/verify/...` → affichage des données minimales.
* **Règles métier** : BR-047.
* **Données** : `Enrollment`, `GeneratedDocument`.
* **Résultat attendu** : Vérification simple, sécurisée.
* **Exceptions** : Lien invalide (404).
* **Priorité** : P1.

## FR-014 — Tableau de bord et rapports

* **Description** : Afficher KPI (inscrits, admis, recettes, taux de présence, etc.) et exporter les listes.
* **Acteurs** : MANAGER, USER.
* **Préconditions** : Données collectées.
* **Workflow** : Dashboard `/` + page rapports.
* **Règles métier** : Dérivés via `derive.ts`.
* **Données** : Aggregations sur `Enrollment`, `Attendance`, `PaymentReceipt`.
* **Résultat attendu** : Vue synthétique et exports exploitables.
* **Exceptions** : -.
* **Priorité** : P1.

## FR-015 — Audit trail

* **Description** : Tracer les actions critiques (modification de notes, changement de groupe, paiement, émission de document, verrouillage).
* **Acteurs** : Système.
* **Préconditions** : -.
* **Workflow** : Chaque action métier d'écriture appelle `logAudit` dans une transaction.
* **Règles métier** : BR-016, BR-031, BR-045.
* **Données** : `AuditLog`.
* **Résultat attendu** : Historique des modifications opposable.
* **Exceptions** : Échec d'audit = échec opération.
* **Priorité** : P1.

## FR-016 — Import / Export Excel et CSV

* **Description** : Importer participants, inscriptions, notes ; exporter listes, résultats, paiements.
* **Acteurs** : MANAGER, USER.
* **Préconditions** : Fichier conforme.
* **Workflow** : Sélection fichier → validation → import → rapport.
* **Règles métier** : Import actuel + export symétrique.
* **Données** : Fichiers tableurs.
* **Résultat attendu** : Import/export sans perte de données.
* **Exceptions** : Format invalide (400), lignes en erreur listées.
* **Priorité** : P1.

## FR-017 — Notifications et relances

* **Description** : Envoyer des notifications internes et éventuellement des emails sur événements importants.
* **Acteurs** : Système.
* **Préconditions** : Configuration SMTP (optionnel).
* **Workflow** : Événement → notification/email.
* **Règles métier** : -.
* **Données** : `Notification`, `NotificationTemplate`.
* **Résultat attendu** : Relances aux inscrits et alertes agents.
* **Exceptions** : Service email indisponible (dégradé).
* **Priorité** : P2.

## FR-018 — Historique académique

* **Description** : Maintenir un historique des niveaux obtenus par participant.
* **Acteurs** : Système.
* **Préconditions** : Session finalisée.
* **Workflow** : À la clôture, enregistrer le niveau validé.
* **Règles métier** : BR-026.
* **Données** : `AcquiredLevel`.
* **Résultat attendu** : Réinscription facilitée.
* **Exceptions** : -.
* **Priorité** : P2.
