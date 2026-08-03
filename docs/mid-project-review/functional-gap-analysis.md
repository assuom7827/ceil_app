# Functional Gap Analysis — CEIL

## Légende des états

| Symbole | État |
|---|---|
| ✅ | Complete |
| 🟡 | Partial |
| 🔴 | Missing |
| ⚠️ | Inconsistent |
| 💡 | Improvement |

## Priorités

| Priorité | Signification |
|---|---|
| P0 — Critical | Bloquant pour la production ou la cohérence métier |
| P1 — High | Forte valeur ajoutée, à faire rapidement |
| P2 — Medium | Amélioration notable mais pas bloquante |
| P3 — Nice to have | À envisager plus tard |

## A. Authentification et comptes

| ID | Fonctionnalité | État actuel | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| AUTH-01 | Login / logout | ✅ | Message d'erreur uniforme ; pas de rate limiting | Risque de brute force | P0 | Ajouter rate limiting + protection CSRF |
| AUTH-02 | Changement de mot de passe | 🟡 | disponible en UI, action serveur possible | Pas d'endpoint API dédié documenté | P2 | Normaliser via API `/auth/change-password` |
| AUTH-03 | Réinitialisation du mot de passe | 🔴 | Absente | ADMIN doit intervenir | P1 | Permettre à ADMIN de régénérer ou reset mdp |
| AUTH-04 | Gestion du profil | 🟡 | Lecture (user menu), mais pas d'édition de profil | UX limitée | P2 | Permettre mise à jour nom/email (pas rôle) |
| AUTH-05 | Rôles | 🟡 | 3 rôles (ADMIN, MANAGER, USER) | USER trop permissif en écriture | P0 | Restreindre USER à lecture + actions métier ciblées |
| AUTH-06 | Permissions | 🟡 | RBAC ressource/role | Pas de vérification de portée (ownership) | P1 | Ajouter scoping si nécessaire |
| AUTH-07 | Sessions / révocation | 🔴 | JWT sans révocation explicite | Compte désactivé reste actif jusqu'à expiration | P1 | Réduire TTL + vérifier actif à chaque requête |
| AUTH-08 | Sécurité des comptes | 🟡 | Mot de passe 10 caractères minimum | Pas de complexité explicite | P2 | Ajouter complexité (maj/min/chiffre/spécial) |

## B. Gestion des apprenants (participants)

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| PART-01 | Création participant | ✅ | Transactionnelle, matricule atomique | OK | - | - |
| PART-02 | Modification participant | ✅ | CRUD standard | Risque de doublons si nom mal saisi | P2 | Détection de doublons + fusion |
| PART-03 | Recherche / filtrage | 🟡 | Recherche textuelle simple | Pas de recherche avancée/facette | P2 | Filtres multicritères |
| PART-04 | Historique inscriptions | 🔴 | Aucune vue agrégée par participant | Difficile de suivre la progression | P1 | Page détail participant avec historique |
| PART-05 | Informations personnelles | 🟡 | Nom, prénom, date/lieu naissance, genre | Pas d'adresse, photo, pièce d'identité | P2 | Ajouter adresse, pièces, photo |
| PART-06 | Catégories | ✅ | M2N catégories | OK | - | - |
| PART-07 | Faculté | ✅ | FK faculté | OK | - | - |
| PART-08 | Documents personnels | 🔴 | Aucun | Dossier participant incomplet | P2 | Upload pièces d'identité/justificatifs |

## C. Gestion des formations

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| FORM-01 | Langues / formations | ✅ | CRUD Training | OK | - | - |
| FORM-02 | Niveaux CECRL | ✅ | Intervalles de points | Pas de contrainte DB d'non-chevauchement | P1 | Vérifier contiguïté/non-chevauchement en DB |
| FORM-03 | Programmes | 🔴 | Aucune entité programme | Contenu pédagogique absent | P3 | Module de programme par niveau |
| FORM-04 | Sessions | ✅ | CRUD session | Incohérence mono/multi-niveaux | P0 | Clarifier ou supprimer `trainingLevelId` |
| FORM-05 | Périodes / dates session | 🟡 | `dateFrom`/`dateTo` optionnels | Pas de validation `dateTo > dateFrom` | P2 | Validation Zod + DB |
| FORM-06 | Groupes | ✅ | Gabarits + groupes réels | Pas de salle, pas de conflits | P1 | Ajouter Room + planning |
| FORM-07 | Capacité | 🟡 | Champ `capacity` sur groupe | Non validée en écriture pour `assignGroupsByLevel` (race condition) | P0 | Verrou + contrainte métier |
| FORM-08 | Enseignants | ✅ | CRUD Teacher | Pas d'indisponibilités | P2 | Indisponibilités / emploi du temps enseignant |
| FORM-09 | Salles | 🔴 | Aucune entité | Impossible de vérifier les conflits | P0 | Ajouter `Room`/`Site` |

## D. Test de positionnement

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| POS-01 | Création du test | ✅ | CRUD PositioningTest | OK | - | - |
| POS-02 | Questions / barème | 🔴 | Pas de banque de questions, seulement 2 notes écrites | Le test n'est pas un vrai QCM | P2 | Définir le vrai processus du CEIL |
| POS-03 | Correction / score | ✅ | E.E + C.E = total | OK | - | - |
| POS-04 | Attribution niveau | ✅ | Intervalles CECRL | OK | - | - |
| POS-05 | Règle nouveau vs ancien | 🟡 | `EnrollmentKind` NEW/RETURNING | Pas de workflow différencié | P1 | Bloquer inscription sans test pour NEW ; proposer niveau+1 pour RETURNING |
| POS-06 | Import de notes | 🟡 | Import CSV/Excel exists | Ne crée pas de nouvelles notes | P0 | Créer `PositioningScore` si inexistant lors de l'import |
| POS-07 | Historique | 🟡 | Lié à `PositioningScore` | Pas d'historique des sessions antérieures par participant | P2 | Vue historique participant |
| POS-08 | Traçabilité | 🟡 | Audit log partiel | OK | - | - |

## E. Inscriptions

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| INS-01 | Préinscription | 🔴 | Aucun statut préinscrit | Ergonomie métier | P2 | Statut d'inscription |
| INS-02 | Inscription | ✅ | Processus en une étape | OK | - | - |
| INS-03 | Réinscription | 🟡 | `EnrollmentKind.RETURNING` existe | Pas de workflow de proposition niveau+1 | P1 | Proposer niveau supérieur depuis historique |
| INS-04 | Validation | 🟡 | Verrouillage session | Pas de statut confirmé/annulé | P1 | Ajouter `Enrollment.status` |
| INS-05 | Affectation groupe | ✅ | En masse par niveau | Race condition capacité | P0 | Transaction + verrou |
| INS-06 | Paiement lié | 🟡 | `PaymentReceipt` lié participant/session | Pas lié explicitement à l'inscription | P1 | Lien `enrollmentId` optionnel |
| INS-07 | Annulation / transfert | 🔴 | Aucun statut d'annulation | Perte d'historique | P1 | Statut annulé + raison |
| INS-08 | Changement de groupe/niveau | 🟡 | PATCH enrollment possible | Pas de justification/audit ciblés | P1 | Audit dédié des changements |
| INS-09 | Historique | 🔴 | Pas d'historique des changements | Traçabilité insuffisante | P1 | `EnrollmentChangeLog` |

## F. Groupes et planning

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| GROUP-01 | Création groupes | ✅ | Organize by level + templates | OK | - | - |
| GROUP-02 | Gestion capacité | 🟡 | Champ capacity | Non vérifiée strictement | P0 | Verrou / CHECK métier |
| GROUP-03 | Affectation | ✅ | Par niveau / par examen | OK | - | - |
| GROUP-04 | Enseignant par groupe | ✅ | `teacherId` | OK | - | - |
| GROUP-05 | Salle | 🔴 | Aucune entité | Impossible de vérifier conflits | P0 | Ajouter `Room` |
| GROUP-06 | Horaires | 🟡 | `startTime`/`endTime` texte | Pas de validation d'ordre, pas de récurrence | P1 | `ScheduleEntry` récurrent |
| GROUP-07 | Conflits horaires | 🔴 | Non détectés | Surbooking possible | P0 | Détecter conflits prof/salle |
| GROUP-08 | Calendrier | 🔴 | Aucun calendrier visuel | UX planning | P2 | Vue calendrier semaine/mois |

## G. Présence / Absence

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| ATT-01 | Présence | 🔴 | Absente | Suivi pédagogique impossible | P0 | Ajouter `Attendance` |
| ATT-02 | Absence | 🔴 | Absente | Condition de certification non traçable | P0 | Idem |
| ATT-03 | Retard | 🔴 | Absent | Assiduité incomplète | P0 | Idem |
| ATT-04 | Justification | 🔴 | Absente | Discrimination absences justifiées/non justifiées impossible | P1 | Ajouter type/justificatif |
| ATT-05 | Statistiques / taux | 🔴 | Absentes | Tableau de bord incomplet | P1 | Calculer taux d'assiduité |
| ATT-06 | Impact certification | 🔴 | Non implémenté | Règle métier absente | P1 | Empêcher diplôme si taux absence > seuil |

## H. Évaluations

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| EVAL-01 | Contrôle continu | 🔴 | Aucune note intermédiaire | Pédagogie incomplète | P2 | `ContinuousAssessment` |
| EVAL-02 | Examen final | 🟡 | Délibération 4 compétences | OK | - | - |
| EVAL-03 | Note | ✅ | Délégation Zod | Max 1000 arbitraire | P2 | Lier max au barème/session |
| EVAL-04 | Résultat / admission | ✅ | Dérivé seuil | OK | - | - |
| EVAL-05 | Progression | 🔴 | Aucun suivi de progression historique | Pédagogie | P3 | Historique par compétence |
| EVAL-06 | Certification | 🟡 | Diplômes/admissions | Pas d'historique d'émission | P1 | `GeneratedDocument` |

## I. Paiements / finances

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| PAY-01 | Tarifs | 🔴 | Aucun modèle de tarification | Contrôle des impayés impossible | P0 | Ajouter `Pricing` |
| PAY-02 | Paiement | ✅ | CRUD reçu | Montant libre sans référence tarifaire | P0 | Lier à tarif / calculer solde |
| PAY-03 | Mode de paiement | 🔴 | Absent | Caisse/tracking | P1 | Enum mode (espèce/chèque/virement) |
| PAY-04 | Statut reçu | 🟡 | DRAFT/CONFIRMED | Pas de CANCELLED/REFUNDED | P1 | Élargir les états |
| PAY-05 | Historique | 🟡 | Par participant/session | Pas par inscription | P2 | Vue consolidée |
| PAY-06 | Remboursement | 🔴 | Absent | Comptabilité incomplète | P2 | Avoir/remboursement |
| PAY-07 | Statistiques financières | 🔴 | Dashboard minimal | Pas de recettes/impayés par session | P1 | KPI financiers |
| PAY-08 | Export comptable | 🔴 | Absent | Triésorerie | P2 | Export journal des recettes |

## J. Documents administratifs

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| DOC-01 | Attestation d'inscription | ✅ | Page HTML + route | Rédaction provisoire | P2 | Texte réglementaire CEIL |
| DOC-02 | Certificat / diplôme | ✅ | HTML + ODT téléversable | Historique d'émission absent | P1 | `GeneratedDocument` |
| DOC-03 | Attestation de formation | ✅ | Certificat ODT | OK | - | - |
| DOC-04 | Relevé de notes | 🟡 | PV contient notes | Pas de relevé individuel | P2 | Relevé par participant |
| DOC-05 | Numérotation | 🟡 | Matricule d'inscription | Numéro de registre séparé non géré | P2 | Gérer `registerNumber` selon politique CEIL |
| DOC-06 | QR code | 🟡 | Génération présente dans code ODT | Pas de QR unique injecté / vérification limitée | P1 | QR unique + vérification publique sécurisée |
| DOC-07 | Version arabe/française | ✅ | Documents bilingues | Layout RTL partiel | P2 | Corriger positionnement RTL |
| DOC-08 | Archivage | 🔴 | Aucun | Non traçable | P1 | `GeneratedDocument` + stockage |
| DOC-09 | Traçabilité | 🟡 | Audit log partiel | Pas d'audit documentaire dédié | P1 | Tracer toute émission PDF |

## K. Notifications

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| NOT-01 | Notifications système | 🔴 | Absentes | Pas de relance | P1 | Toasts + badges |
| NOT-02 | Notifications email | 🔴 | Absentes | Communication externe impossible | P1 | Envoi récapitulatif/inscription |
| NOT-03 | Rappels | 🔴 | Absents | Séances manquées | P2 | Rappel automatique |
| NOT-04 | Événements importants | 🔴 | Absents | Pas de workflow evenementiel | P2 | Événements session, échéances |

## L. Reporting / Dashboard

| ID | Fonctionnalité | État | Problème | Impact | Priorité | Proposition |
|---|---|---|---|---|---|---|
| RPT-01 | Nombre d'apprenants | ✅ | Dashboard | OK | - | - |
| RPT-02 | Inscriptions | ✅ | Sessions récentes | OK | - | - |
| RPT-03 | Groupes | ✅ | Compteurs | OK | - | - |
| RPT-04 | Formations | ✅ | Liste | OK | - | - |
| RPT-05 | Taux de présence | 🔴 | Absent (pas de données) | Non calculable | P0 | Après implémentation absences |
| RPT-06 | Résultats | 🟡 | Admis/ajournés/non délibérés | OK | - | - |
| RPT-07 | Paiements / recettes | 🔴 | Dashboard non financier | Pas de KPI recettes | P1 | Après module pricing |
| RPT-08 | Progression | 🔴 | Absente | Aucun historique | P3 | Historique par compétence |
| RPT-09 | Statistiques par langue/niveau/session | 🟡 | Quelques données | Pas de rapport détaillé | P1 | Page rapports + exports |

---

## Synthèse par domaine

| Domaine | Complètes | Partielles | Manquantes | Critiques |
|---|---|---|---|---|
| Authentification | 1 | 4 | 3 | USER trop permissif, rate limiting |
| Apprenants | 3 | 4 | 2 | Historique, documents |
| Formations | 3 | 3 | 3 | Salles, conflits, mono/multi-niveaux |
| Positionnement | 4 | 4 | 0 | Import création notes |
| Inscriptions | 2 | 4 | 3 | Statuts, annulation, historique |
| Groupes / Planning | 3 | 2 | 3 | Salles, conflits, calendrier |
| Présence | 0 | 0 | 6 | Fonction entière absente |
| Évaluations | 2 | 2 | 2 | Contrôle continu, historique |
| Paiements | 1 | 3 | 4 | Tarification, remboursement |
| Documents | 4 | 4 | 2 | Archivage, traçabilité |
| Notifications | 0 | 0 | 4 | Fonction entière absente |
| Reporting | 4 | 2 | 3 | Présence, finances, rapports |
