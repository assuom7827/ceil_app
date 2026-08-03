# Fonctionnalités proposées — CEIL

## Méthode de classification

* **Must Have** : indispensable au fonctionnement professionnel du CEIL.
* **Should Have** : important, mais le CEIL peut fonctionner sans dans un premier temps.
* **Could Have** : amélioration notable, valeur pédagogique ou UX.
* **Future** : évolutions avancées à envisager plus tard.

Aucune proposition n'est "over-engineered" ; chacune répond à un besoin métier concret.

---

## Must Have

### PF-001 — Gestion des salles et sites

* **Problème métier** : impossible de savoir où se déroulent les cours et d'éviter les surbookings.
* **Utilisateur** : MANAGER, USER.
* **Description** : CRUD des sites et salles, capacité par salle.
* **Workflow** : Références → Sites/Salles → affectation dans le groupe/planning.
* **Données** : `Site`, `Room`.
* **Règles métier** : BR-032, BR-034.
* **Permissions** : MANAGER (écriture), USER (lecture).
* **Impact** : Schéma, API CRUD, formulaires `StudentGroup`, `ScheduleEntry`.
* **Priorité** : P0.
* **Complexité** : Moyenne.

### PF-002 — Planning et emploi du temps des groupes

* **Problème métier** : actuellement seuls `dateStart`, `dateEnd`, `startTime`, `endTime` existent ; pas de récurrence, pas de gestion des congés.
* **Utilisateur** : MANAGER, USER.
* **Description** : Définir les séances récurrentes (jour, horaire, salle, enseignant) par groupe.
* **Workflow** : Groupes → ajouter séances → détection de conflits.
* **Données** : `ScheduleEntry`.
* **Règles métier** : BR-033, BR-034.
* **Permissions** : MANAGER (écriture), USER (lecture).
* **Impact** : Schéma, services `groups.ts`, UI planning.
* **Priorité** : P0.
* **Complexité** : Élevée.

### PF-003 — Suivi des présences/absences

* **Problème métier** : pas de suivi pédagogique, impossible de conditionner la certification à l'assiduité.
* **Utilisateur** : Enseignant (saisie), MANAGER (lecture).
* **Description** : Faire l'appel séance par séance ; marquer présent/absent/retard/justifié.
* **Workflow** : Séance → liste des inscrits → appel → sauvegarde.
* **Données** : `Attendance`.
* **Règles métier** : BR-036, BR-037, BR-038.
* **Permissions** : Enseignant propre groupe / MANAGER.
* **Impact** : Schéma, nouveaux services, nouveaux onglets workspace.
* **Priorité** : P0.
* **Complexité** : Élevée.

### PF-004 — Tarification et suivi des paiements

* **Problème métier** : les reçus flottent sans tarif de référence ; impayés inconnus.
* **Utilisateur** : MANAGER, USER.
* **Description** : Définir les tarifs par formation/niveau/catégorie ; lier reçu à inscription ; calculer solde.
* **Workflow** : Références → Tarifs → reçu → solde.
* **Données** : `Pricing`, `PaymentReceipt` (avec `enrollmentId`).
* **Règles métier** : BR-041, BR-042, BR-044.
* **Permissions** : MANAGER (écriture tarifs), USER (saisie reçus).
* **Impact** : Schéma, services paiements, dashboard financier.
* **Priorité** : P0.
* **Complexité** : Élevée.

### PF-005 — Statuts d'inscription

* **Problème métier** : pas de workflow pré-inscription / confirmé / annulé.
* **Utilisateur** : MANAGER, USER.
* **Description** : Ajouter un statut à l'inscription et un historique des changements.
* **Workflow** : Inscription → pré-inscrit → confirmé (après paiement/test) ou annulé/transféré.
* **Données** : `Enrollment.status`, `EnrollmentStatusLog`.
* **Règles métier** : BR-029, BR-030, BR-031.
* **Permissions** : MANAGER, USER.
* **Impact** : Schéma, services, UI inscrits.
* **Priorité** : P1.
* **Complexité** : Moyenne.

### PF-006 — Export Excel / CSV des listes et résultats

* **Problème métier** : les imports existent, pas les exports ; la seule sortie est l'impression A4.
* **Utilisateur** : MANAGER, USER.
* **Description** : Exporter inscriptions, groupes, notes, présences, paiements en tableur.
* **Workflow** : Workspace → Export → téléchargement.
* **Données** : Agrégations existantes.
* **Règles métier** : -.
* **Permissions** : MANAGER, USER (lecture selon RBAC).
* **Impact** : Service `exports.ts`, UI, tests.
* **Priorité** : P1.
* **Complexité** : Faible à moyenne.

---

## Should Have

### PF-007 — Historique des documents émis

* **Problème métier** : on ne sait pas quelles attestations ont été générées, par qui, quand.
* **Utilisateur** : MANAGER.
* **Description** : Tracer chaque émission de PV, diplôme, attestation, liste.
* **Données** : `GeneratedDocument`.
* **Permissions** : MANAGER.
* **Impact** : Schéma, services documents.
* **Priorité** : P1.
* **Complexité** : Moyenne.

### PF-008 — Vérification publique sécurisée

* **Problème métier** : la page `/verify` est fonctionnelle mais mal formée et potentiellement exposée.
* **Utilisateur** : Public.
* **Description** : Page institutionnelle avec QR code, identifiant opaque, données minimales.
* **Données** : `GeneratedDocument`.
* **Règles métier** : BR-047.
* **Impact** : API verify, UI, sécurité.
* **Priorité** : P1.
* **Complexité** : Moyenne.

### PF-009 — Notifications et relances

* **Problème métier** : pas de communication automatisée avec les participants.
* **Utilisateur** : Système.
* **Description** : Notifications internes (badges/toasts) et emails de relance pour paiement, séance, résultats.
* **Données** : `Notification`, template email.
* **Impact** : Schéma, service de notification, configuration SMTP.
* **Priorité** : P2.
* **Complexité** : Moyenne.

### PF-010 — Historique académique / niveaux obtenus

* **Problème métier** : la réinscription d'un ancien participant ne s'appuie sur aucun historique fiable.
* **Utilisateur** : MANAGER.
* **Description** : Conserver les niveaux validés par session pour orienter le niveau suivant.
* **Données** : `AcquiredLevel`.
* **Règles métier** : BR-026.
* **Impact** : Schéma, services réinscription.
* **Priorité** : P2.
* **Complexité** : Moyenne.

### PF-011 — Assistant de configuration du modèle ODT

* **Problème métier** : la configuration du gabarit d'attestation est technique et peu guidée.
* **Utilisateur** : MANAGER.
* **Description** : Upload guidé, preview des placeholders, test de génération.
* **Impact** : UI, upload, preview PDF.
* **Priorité** : P2.
* **Complexité** : Moyenne.

---

## Could Have

### PF-012 — Contrôle continu

* **Description** : Ajouter des évaluations intermédiaires par compétence entre le positionnement et la délibération.
* **Impact** : Schéma `ContinuousAssessment`, UI notes.
* **Priorité** : P2.

### PF-013 — Mode sombre

* **Description** : Thème clair/sombre accessible.
* **Impact** : `lib/theme.ts`, composants.
* **Priorité** : P3.

### PF-014 — Recherche asynchrone des participants

* **Description** : Remplacer la liste déroulante limitée par une recherche serveur.
* **Impact** : UI inscriptions, paiements.
* **Priorité** : P2.

### PF-015 — Détection et fusion des doublons de participants

* **Description** : Alerte si nom + date de naissance similaires ; fusion des dossiers.
* **Impact** : UI participants, service merge.
* **Priorité** : P2.

---

## Future

### PF-016 — Portail apprenant

* **Description** : Espace self-service pour consulter son planning, ses résultats, ses documents.
* **Impact** : Architecture, authentification, rôles.
* **Priorité** : P3.

### PF-017 — Intégration paiement en ligne

* **Description** : Paiement par CCP, carte ou virement automatique.
* **Impact** : Paiements, sécurité, conformité bancaire.
* **Priorité** : P3.

### PF-018 — Signatures électroniques

* **Description** : Signature numérique des PV et attestations.
* **Impact** : Documents, conformité.
* **Priorité** : P3.

### PF-019 — Statistiques avancées et rapports personnalisés

* **Description** : Rapports comparatifs annuels, taux de réussite par enseignant, etc.
* **Impact** : Dashboard, exports.
* **Priorité** : P3.

---

## Synthèse par priorité

| Niveau | Nombre | Thèmes |
|---|---|---|
| Must Have | 6 | Salles/planning, présences, tarification, statuts inscription, exports |
| Should Have | 5 | Traçabilité documents, vérification publique, notifications, historique académique, assistant ODT |
| Could Have | 4 | Contrôle continu, recherche, doublons, mode sombre |
| Future | 4 | Portail apprenant, paiement en ligne, signatures, statistiques avancées |
