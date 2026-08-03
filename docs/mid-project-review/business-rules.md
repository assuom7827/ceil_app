# Catalogue des règles métier — CEIL

## Principes fondateurs

* Les valeurs dérivées (`fullName`, totaux, statut d'admission, années, mois arabe) ne sont **pas stockées** ; elles sont calculées par `src/services/derive.ts`.
* Le RBAC est vérifié **côté serveur** sur chaque route API.
* La session de formation est l'entité pivot.

## Règles existantes et confirmées par le code

| ID | Règle | Source / implémentation | État |
|---|---|---|---|
| BR-001 | Un participant est identifié par un matricule généré automatiquement. | `Participant.registrationNumber` + `SequenceCounter` | ✅ confirmée |
| BR-002 | Une inscription est unique par participant et par session. | `@@unique([participantId, trainingSessionId])` | ✅ confirmée |
| BR-003 | Le matricule d'inscription est unique dans sa session. | `@@unique([trainingSessionId, registrationNumber])` | ✅ confirmée |
| BR-004 | Un groupe de session cible un seul niveau CECRL. | `StudentGroup.trainingLevelId` | ✅ confirmée |
| BR-005 | Un total de test de positionnement est la somme de E.E et C.E. | `derive.ts => positioningTotal` | ✅ confirmée |
| BR-006 | Le niveau résolu est déterminé par intervalle semi-ouvert `[min, max[`. | `resolveLevelForPoints` | ✅ confirmée |
| BR-007 | Le total de délibération est la somme des 4 compétences. | `derive.ts => deliberationTotal` | ✅ confirmée |
| BR-008 | Un participant est admis si son total ≥ seuil d'admission de la session. | `derive.ts => deriveAdmissionStatus` | ✅ confirmée |
| BR-009 | Une ligne sans note est « non délibérée » et non « ajournée ». | `derive.ts` retourne `null` | ✅ confirmée |
| BR-010 | L'écriture est interdite sur une session ou un test verrouillé. | `assertSessionWritable`, `assertPositioningTestWritable` | ✅ confirmée |
| BR-011 | Un diplôme ne peut être émis que pour un admis. | `certificates.ts` / documents | ✅ confirmée |
| BR-012 | Les documents utilisent les mêmes fonctions dérivées que la grille. | `derive.ts` partagé | ✅ confirmée |
| BR-013 | Les inscriptions en double à une même session sont rejetées. | `enroll()` + contrainte unique | ✅ confirmée |
| BR-014 | L'attribution des groupes par niveau ne dépasse pas la capacité. | `assignGroupsByLevel` (avec race condition) | �à vérifier |
| BR-015 | Un reçu confirmé ne peut être re-confirmé. | `/api/payment-receipts/[id]/confirm` | ✅ confirmée |

## Règles manquantes ou à formaliser

Les règles suivantes sont **nécessaires au fonctionnement professionnel** du CEIL mais ne sont pas (ou partiellement) implémentées.

### Authentification et sécurité

| ID | Règle | Justification | Priorité |
|---|---|---|---|
| BR-016 | Le rôle `USER` ne peut pas supprimer des ressources métier critiques (sessions, groupes, participants, notes). | Séparation des responsabilités ; l'agent métier saisit, il ne supprime pas. | P0 |
| BR-017 | Le dernier administrateur actif ne peut pas être désactivé ni supprimé. | Verrou de garde ; éviter de se retrouver sans accès. | P1 |
| BR-018 | Un compte désactivé ne peut plus accéder à l'application sans délai. | Sécurité ; JWT actuellement sans révocation explicite. | P1 |
| BR-019 | La création d'un compte ADMIN via API est restreinte à localhost. | Droit + endroit ; infrastructure, mais à documenter comme règle. | P1 |

### Apprenants

| ID | Règle | Justification | Priorité |
|---|---|---|---|
| BR-020 | Un participant ne peut pas être supprimé s'il possède des inscriptions ou des paiements. | Intégrité référentielle + historique. | P1 |
| BR-021 | Deux participants avec même nom/prénom/date de naissance doivent être signalés comme doublons potentiels. | Qualité des données. | P2 |

### Formations / sessions

| ID | Règle | Justification | Priorité |
|---|---|---|---|
| BR-022 | La date de fin d'une session doit être postérieure ou égale à la date de début. | Cohérence temporelle. | P2 |
| BR-023 | Une session doit être explicitement mono-niveau ou multi-niveaux ; la relation `trainingLevelId` ne doit pas coexister avec une logique multi-niveaux. | Clarification fonctionnelle critique. | P0 |
| BR-024 | Les niveaux CECRL d'une formation ne doivent pas se chevaucher et doivent être contigus si le total est sur 0..100. | Barème déterministe. | P1 |

### Test de positionnement

| ID | Règle | Justification | Priorité |
|---|---|---|---|
| BR-025 | Un nouveau participant doit obligatoirement passer le test de positionnement avant son inscription à un niveau. | Demandé par le cahier des charges initial. | P0 |
| BR-026 | Un ancien participant ayant validé un niveau peut être orienté vers le niveau suivant. | Demandé par le cahier des charges initial. | P1 |
| BR-027 | Les notes d'un test de positionnement ne peuvent être saisies que pour les inscriptions rattachées à ce test. | Intégrité ; actuellement non vérifié. | P0 |
| BR-028 | L'import de notes de positionnement doit créer les lignes manquantes. | Workflow réel ; actuellement non implémenté. | P0 |

### Inscriptions

| ID | Règle | Justification | Priorité |
|---|---|---|---|
| BR-029 | Une inscription possède un statut (pré-inscrite, confirmée, annulée, transférée). | Workflow administratif complet. | P1 |
| BR-030 | Une inscription annulée ne participe ni aux groupes ni à la délibération. | Cohérence statistique. | P1 |
| BR-031 | Le changement de groupe ou de niveau doit être justifié et audité. | Traçabilité. | P1 |

### Groupes

| ID | Règle | Justification | Priorité |
|---|---|---|---|
| BR-032 | Un groupe de session ne peut pas dépasser sa capacité maximale. | Contrainte métier fondamentale ; actuellement race condition. | P0 |
| BR-033 | Un enseignant ne peut pas être affecté à deux séances simultanées. | Planning. | P1 |
| BR-034 | Une salle ne peut pas être réservée par deux groupes pour la même période. | Planning. | P1 |
| BR-035 | Une session multi-niveaux peut avoir plusieurs groupes pour un même niveau si l'effectif dépasse la capacité. | Métier CEIL. | P1 |

### Présence

| ID | Règle | Justification | Priorité |
|---|---|---|---|
| BR-036 | La présence est enregistrée séance par séance. | Suivi pédagogique. | P0 |
| BR-037 | Un taux d'absence supérieur à un seuil configurable empêche la certification. | Règle fréquente dans les centres de langue. | P1 |
| BR-038 | Une absence peut être justifiée ou non justifiée. | Distinguer absences validées. | P1 |

### Évaluations

| ID | Règle | Justification | Priorité |
|---|---|---|---|
| BR-039 | Les notes saisies doivent respecter le barème et le maximum de la session/niveau. | Actuellement max 1000 arbitraire. | P2 |
| BR-040 | Le statut d'admission est dérivé du total et du seuil ; il n'est pas stocké. | Principe fondateur. | ✅ |

### Paiements

| ID | Règle | Justification | Priorité |
|---|---|---|---|
| BR-041 | Un reçu confirmé ne peut pas être modifié ; il doit faire l'objet d'un avoir ou remboursement. | Intégrité comptable. | P1 |
| BR-042 | Le montant d'un reçu ne peut pas être nul ou négatif. | Cohérence. | P1 |
| BR-043 | Un paiement hors session possible mais traçable. | Besoin de frais divers. | P2 |
| BR-044 | Le solde d'une inscription = tarif applicable − somme des reçus confirmés. | Suivi financier. | P1 |

### Documents

| ID | Règle | Justification | Priorité |
|---|---|---|---|
| BR-045 | L'émission d'un document officiel est archivée (type, date, émetteur). | Opposabilité administrative. | P1 |
| BR-046 | Un document officiel est généré avec une numérotation unique et continue (registre). | Si le CEIL confirme la distinction avec le matricule. | P2 |
| BR-047 | La vérification publique d'authenticité ne doit pas exposer de données sensibles inutilement. | RGPD/PII. | P1 |

---

## Récapitulatif des règles par priorité

| Priorité | Nombre de règles à ajouter | Thèmes |
|---|---|---|
| P0 | 8 | Test de positionnement, capacité groupes, rôle USER, statut session, archivage documents |
| P1 | 18 | Audit, paiements, présences, planning, intégrité référentielle, admin bootstrap |
| P2 | 9 | Validation dates, doublons, barèmes, QR code, numérotation registre |
