# `src/services` — couche métier

**Source unique de vérité** de l'application. Tout ce qui est calculé, décidé ou
contraint vit ici, sous forme de fonctions pures ou de fonctions prenant un
client Prisma en argument. L'API (`app/api/**`) et l'UI importent ces fonctions ;
elles ne recalculent jamais une valeur dérivée de leur côté.

## Fichiers prévus

| Fichier                   | Rôle                                                                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `derive.ts`               | Valeurs **dérivées, jamais stockées** : `deriveParticipantFullName`, `deriveSessionTitle`, `deriveTrainingFullName`, `deriveEntryTotalAndStatus`, `derivePositioningTotal`, `resolveLevelForPoints`, `arabicMonth`, `deriveYears`. |
| `registration-numbers.ts` | Génération atomique des matricules (participant `PART-ETU/ENS-{YYYY}-{n}`, inscription via `matriculePrefix`, reçu `PAY-{YYYY}-{n}`).                                                                                              |
| `locking.ts`              | Règles de verrouillage `OPEN`/`LOCKED` (session, test de positionnement) → conflit 409.                                                                                                                                            |
| `enrollment.ts`           | Inscription simplifiée `enroll(sessionId, participantIds[])`, doublons ignorés.                                                                                                                                                    |
| `positioning.ts`          | `resolveLevels(testId)` : total = E.E + C.E, niveau par intervalle `[min, max[`.                                                                                                                                                   |
| `deliberation.ts`         | `computeAdmission(sessionId)` : total = somme des 4 notes, seuil de la session.                                                                                                                                                    |
| `groups.ts`               | `organizeGroupsByLevel` / `assignGroupsByLevel` (groupes de session par niveau CECRL), `organizeGroups` + `assignExamGroups` (groupes d'examen, indifférents au niveau).                                                           |
| `imports.ts`              | Imports Excel/CSV (inscriptions, notes de positionnement, notes de délibération) avec rapport.                                                                                                                                     |
| `rbac.ts`                 | Vérifications de rôle côté serveur (`MANAGER`/`ADMIN` complet, `USER` restreint).                                                                                                                                                  |

## Règles

1. Aucune valeur dérivée n'est écrite en base.
2. Aucune règle métier n'est dupliquée dans un Route Handler ou un composant.
3. Chaque règle est couverte par un test Vitest.
