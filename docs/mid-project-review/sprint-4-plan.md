# Sprint 4 — Suivi des présences

**Objectif** : implémenter le suivi des présences des participants, avec justification d'absence et calcul automatique du taux de présence.

**Durée estimée** : 2 semaines.

**Équipe suggérée** : 1 dev full-stack + 1 reviewer.

**Definition of Done** :
- Un `USER` peut saisir les présences pour une occurrence de session.
- Les absences peuvent être justifiées avec documents justificatifs.
- Le taux de présence est calculé automatiquement par participant et par session.
- Les tests unitaires, d'intégration et E2E passent.

---

## Tâches du sprint

| ID | Titre | Type | Priorité | Complexité |
|---|---|---|---|---|
| S4-01 | Ajouter le modèle `Attendance` | Data | P0 | M |
| S4-02 | Créer le service de suivi des présences | Feature | P0 | M |
| S4-03 | Ajouter les endpoints API d'assiduité | API | P0 | M |
| S4-04 | Implémenter la justification d'absence | Feature | P1 | M |
| S4-05 | Calculer le taux de présence | Feature | P1 | M |
| S4-06 | Ajouter les exports de présence | Feature | P1 | S |
| S4-07 | Tests E2E du workflow de présence | Testing | P1 | M |

---

## Détail des tâches

### S4-01 — Ajouter le modèle `Attendance`

**Solution**
1. Ajouter le modèle Prisma :
   ```prisma
   model Attendance {
     id               String           @id @default(cuid())
     enrollmentId     String
     sessionOccurrenceId String
     status           AttendanceStatus
     justification    String?
     documentUrl      String?          // Pièce justificative
     recordedAt       DateTime         @default(now())
     recordedBy       String           // userId

     enrollment       Enrollment       @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
     sessionOccurrence SessionOccurrence @relation(fields: [sessionOccurrenceId], references: [id], onDelete: Cascade)

     @@unique([enrollmentId, sessionOccurrenceId])
     @@index([enrollmentId])
     @@index([sessionOccurrenceId])
     @@map("attendances")
   }

   enum AttendanceStatus {
     PRESENT
     ABSENT
     LATE
     EXCUSED
   }
   ```
2. Ajouter la relation inverse `attendances` sur `Enrollment` et `SessionOccurrence`.

**Fichiers à modifier**
- `prisma/schema.prisma`
- `src/services/rbac.ts` (ajouter `Attendance` aux ressources protégées)
- `src/lib/validations/attendance.ts` (nouveau)

**Tests**
- Tests de schéma Prisma.
- Tests d'intégration : créer une présence, vérifier la contrainte d'unicité.

**Estimation** : 1 jour.

---

### S4-02 — Créer le service de suivi des présences

**Solution**
1. Créer `src/services/attendance.ts` avec :
   ```ts
   export async function recordAttendance(
     db: Db,
     enrollmentId: string,
     sessionOccurrenceId: string,
     status: AttendanceStatus,
     actorId: string,
     options?: { justification?: string; documentUrl?: string },
   ): Promise<Attendance>

   export async function bulkRecordAttendance(
     db: Db,
     sessionOccurrenceId: string,
     records: Array<{ enrollmentId: string; status: AttendanceStatus; justification?: string }>,
     actorId: string,
   ): Promise<Attendance[]>

   export async function getAttendanceForSession(
     db: Db,
     trainingSessionId: string,
   ): Promise<Array<{ enrollmentId: string; participantName: string; occurrences: Attendance[] }>>
   ```
2. `bulkRecordAttendance` utilise `withTransaction` pour garantir la cohérence.
3. Vérifier que l'`enrollmentId` appartient bien à la `trainingSessionId` via la `sessionOccurrence`.

**Fichiers à modifier / créer**
- `src/services/attendance.ts` (nouveau)

**Tests**
- Tests unitaires : enregistrement simple, enregistrement en masse.
- Tests d'intégration : enrollmentId invalide → erreur 404.

**Estimation** : 1,5 jour.

---

### S4-03 — Ajouter les endpoints API d'assiduité

**Solution**
1. `POST /api/sessions/[id]/occurrences/[occurrenceId]/attendance` :
   ```ts
   export const POST = route<{ id: string; occurrenceId: string }>(
     { resource: 'TrainingSession', access: 'write' },
     async ({ db, params, actor, request }) => {
       const { enrollmentId, status, justification, documentUrl } = await readJson(request);
       await recordAttendance(db, enrollmentId, params.occurrenceId, status, actor.id, { justification, documentUrl });
       return NextResponse.json({ ok: true }, { status: 201 });
     },
   );
   ```
2. `POST /api/sessions/[id]/occurrences/[occurrenceId]/attendance/bulk` pour l'enregistrement en masse.
3. `GET /api/sessions/[id]/attendance` pour récupérer toutes les présences de la session.

**Fichiers à modifier / créer**
- `src/app/api/sessions/[id]/occurrences/[occurrenceId]/attendance/route.ts` (nouveau)
- `src/app/api/sessions/[id]/occurrences/[occurrenceId]/attendance/bulk/route.ts` (nouveau)
- `src/app/api/sessions/[id]/attendance/route.ts` (nouveau)

**Tests**
- Tests d'intégration : enregistrer une présence → 201.
- Tests d'intégration : enregistrement en masse → toutes les présences créées.
- Tests RBAC : `USER` non délégué → 403.

**Estimation** : 1,5 jour.

---

### S4-04 — Implémenter la justification d'absence

**Solution**
1. Permettre l'upload d'un document justificatif via `POST /api/attendance/[id]/justification` :
   - Accepter `multipart/form-data`.
   - Stocker le fichier dans `public/uploads/attendance/` ou un stockage objet.
   - Enregistrer l'URL dans `Attendance.documentUrl`.
2. Ajouter la validation : types acceptés (`pdf`, `jpg`, `png`), taille max (`5MB`).
3. Ajouter un endpoint `GET /api/attendance/[id]/justification` pour télécharger le document.

**Fichiers à modifier / créer**
- `src/app/api/attendance/[id]/justification/route.ts` (nouveau)
- `src/lib/storage/upload.ts` (si pas existant)

**Tests**
- Tests d'intégration : upload d'un justificatif → URL enregistrée.
- Tests d'intégration : fichier trop volumineux → erreur 413.

**Estimation** : 1 jour.

---

### S4-05 — Calculer le taux de présence

**Solution**
1. Ajouter dans `src/services/attendance.ts` :
   ```ts
   export async function getAttendanceRate(
     db: Db,
     enrollmentId: string,
   ): Promise<{ present: number; total: number; rate: number }>
   ```
2. Logique :
   - `total` = nombre d'occurrences de la session de l'inscription.
   - `present` = nombre d'occurrences avec statut `PRESENT` ou `LATE`.
   - `rate` = `present / total * 100` (arrondi à 1 décimale).
3. Exposer via `GET /api/enrollments/[id]/attendance-rate`.
4. Ajouter un champ calculé `attendanceRate` dans la réponse de `GET /api/enrollments/[id]`.

**Fichiers à modifier / créer**
- `src/services/attendance.ts` (complété)
- `src/app/api/enrollments/[id]/attendance-rate/route.ts` (nouveau)

**Tests**
- Tests unitaires : taux de présence 100%, 50%, 0%.
- Tests d'intégration : pas d'occurrences → taux 0%.

**Estimation** : 1 jour.

---

### S4-06 — Ajouter les exports de présence

**Solution**
1. `GET /api/sessions/[id]/attendance/export` :
   - Formats : CSV, Excel (`xlsx` via `exceljs`).
   - Colonnes : Nom participant, Email, Nb présences, Nb absences, Nb retards, Taux de présence.
2. `GET /api/sessions/[id]/attendance/[enrollmentId]/export` pour un participant.
3. Ajouter la génération de PDF récapitulatif par participant (reporting mensuel).

**Fichiers à modifier / créer**
- `src/app/api/sessions/[id]/attendance/export/route.ts` (nouveau)
- `src/services/exports.ts` (complété)

**Tests**
- Tests d'intégration : export CSV → fichier valide.
- Tests d'intégration : export Excel → fichier valide.

**Estimation** : 1 jour.

---

### S4-07 — Tests E2E du workflow de présence

**Objectif**
Vérifier que le suivi des présences fonctionne de la saisie à l'export.

**Scénarios**

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

**Estimation** : 1,5 jour.

---

## Ordre de traitement recommandé

```
Jour 1 : S4-01 (modèle Attendance)
Jour 2 : S4-02 (service attendance)
Jour 3 : S4-03 (API attendance) — début
Jour 4 : S4-03 (suite) + S4-04 (justification)
Jour 5 : S4-05 (taux de présence)
Jour 6 : S4-06 (exports)
Jour 7 : S4-07 (tests E2E) — début
Jour 8-9 : S4-07 (suite) + revue + merge
```

## Risques du sprint

| Risque | Mitigation |
|---|---|
| Performance des requêtes d'agrégation de présence | Index sur `(enrollmentId, sessionOccurrenceId)`. |
| Upload de fichiers volumineux | Limiter la taille, utiliser un stockage objet (S3/MinIO) en production. |
| Calcul du taux en temps réel | Mettre en cache le résultat si nécessaire, recalculer lors de l'ajout d'une occurrence. |

## Livrables

1. `prisma/schema.prisma` mis à jour + migration.
2. `src/services/attendance.ts` (nouveau service).
3. `src/app/api/sessions/[id]/occurrences/[occurrenceId]/attendance/` (nouveaux endpoints).
4. `src/app/api/enrollments/[id]/attendance-rate/route.ts` (nouveau).
5. `src/app/api/sessions/[id]/attendance/export/route.ts` (nouveau).
6. UI : tableau de présence par occurrence, indicateurs visuels.
7. Tests unitaires, d'intégration et E2E.
