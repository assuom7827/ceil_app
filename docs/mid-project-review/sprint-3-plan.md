# Sprint 3 — Sites, salles et planning récurrent

**Objectif** : ajouter la gestion des sites et salles, ainsi qu'un planning récurrent des sessions avec détection de conflits.

**Durée estimée** : 2 semaines.

**Équipe suggérée** : 1 dev full-stack + 1 reviewer.

**Definition of Done** :
- Un `MANAGER` peut créer des sites et des salles, puis les affecter à des sessions.
- Le planning récurrent génère les occurrences de session et détecte les conflits de salle.
- Les tests unitaires, d'intégration et E2E passent.
- Aucune régression fonctionnelle n'est introduite.

---

## Tâches du sprint

| ID | Titre | Type | Priorité | Complexité |
|---|---|---|---|---|
| S3-01 | Ajouter le modèle `Site` et `Room` | Data | P0 | M |
| S3-02 | Ajouter le modèle `SessionOccurrence` | Data | P0 | M |
| S3-03 | Créer le service de planification récurrente | Feature | P0 | L |
| S3-04 | Détecter les conflits de salle | Feature | P0 | M |
| S3-05 | Ajouter les endpoints CRUD `Site`/`Room` | API | P0 | M |
| S3-06 | Mettre à jour `TrainingSession` avec site/salle | Feature | P1 | M |
| S3-07 | Tests E2E du planning et des conflits | Testing | P1 | L |

---

## Détail des tâches

### S3-01 — Ajouter le modèle `Site` et `Room`

**Solution**
1. Ajouter les modèles Prisma :
   ```prisma
   model Site {
     id        String    @id @default(cuid())
     name      String
     address   String?
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     rooms     Room[]
     sessions  TrainingSession[]
     @@map("sites")
   }

   model Room {
     id           String    @id @default(cuid())
     siteId       String
     name         String
     capacity     Int?
     equipment    String?   // JSON : {"projector": true, "whiteboard": true}
     createdAt    DateTime @default(now())
     updatedAt    DateTime @updatedAt

     site         Site       @relation(fields: [siteId], references: [id], onDelete: Cascade)
     occurrences  SessionOccurrence[]

     @@index([siteId])
     @@map("rooms")
   }
   ```
2. Ajouter `siteId` et `roomId` à `TrainingSession` (nullable pour l'instant, rendu obligatoire à la fin du sprint si validé).

**Fichiers à modifier**
- `prisma/schema.prisma`
- `src/services/rbac.ts` (ajouter `Site` et `Room` aux ressources protégées)
- `src/lib/validations/site.ts`, `src/lib/validations/room.ts` (nouveaux)

**Tests**
- Tests de schéma Prisma.
- Tests d'intégration : créer un site, une salle, les lier.

**Estimation** : 1 jour.

---

### S3-02 — Ajouter le modèle `SessionOccurrence`

**Solution**
1. Ajouter le modèle Prisma :
   ```prisma
   model SessionOccurrence {
     id               String    @id @default(cuid())
     trainingSessionId String
     roomId           String?
     startDateTime    DateTime
     endDateTime      DateTime
     createdAt        DateTime @default(now())
     updatedAt        DateTime @updatedAt

     trainingSession  TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Cascade)
     room             Room?           @relation(fields: [roomId], references: [id])

     @@index([trainingSessionId])
     @@index([roomId])
     @@index([startDateTime, endDateTime])
     @@map("session_occurrences")
   }
   ```
2. Les occurrences sont générées automatiquement à partir des paramètres de récurrence de `TrainingSession`.

**Fichiers à modifier**
- `prisma/schema.prisma`

**Tests**
- Tests de schéma Prisma.
- Tests d'intégration : créer une session récurrente → occurrences générées.

**Estimation** : 1 jour.

---

### S3-03 — Créer le service de planification récurrente

**Solution**
1. Créer `src/services/scheduling.ts` avec :
   ```ts
   export interface RecurrenceRule {
     frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
     interval: number; // tous les N jours/semaines/mois
     endDate?: Date;
     count?: number; // nombre d'occurrences
     daysOfWeek?: number[]; // 0-6 pour WEEKLY
     excludeDates?: Date[]; // dates à sauter
   }

   export async function generateOccurrences(
     db: Db,
     trainingSessionId: string,
     rule: RecurrenceRule,
     startDateTime: Date,
     endDateTime: Date,
     roomId?: string,
   ): Promise<SessionOccurrence[]>
   ```
2. Algorithme :
   - Itérer à partir de `startDateTime` selon la fréquence.
   - S'arrêter à `endDate` ou après `count` occurrences.
   - Filtrer les dates exclues.
   - Vérifier les conflits avant insertion (S3-04).
3. Exposer via `POST /api/sessions/[id]/schedule`.

**Fichiers à modifier / créer**
- `src/services/scheduling.ts` (nouveau)
- `src/app/api/sessions/[id]/schedule/route.ts` (nouveau)
- `src/lib/validations/scheduling.ts` (nouveau)

**Tests**
- Tests unitaires : générer des occurrences pour chaque fréquence.
- Tests d'intégration : endpoint retourne les occurrences créées.

**Estimation** : 2 jours.

---

### S3-04 — Détecter les conflits de salle

**Solution**
1. Dans `src/services/scheduling.ts`, ajouter :
   ```ts
   export async function findRoomConflicts(
     db: Db,
     roomId: string,
     startDateTime: Date,
     endDateTime: Date,
     excludeOccurrenceId?: string,
   ): Promise<SessionOccurrence[]>
   ```
2. Logique de chevauchement :
   ```ts
   const conflicts = await db.sessionOccurrence.findMany({
     where: {
       roomId,
       id: { not: excludeOccurrenceId },
       AND: [
         { startDateTime: { lt: endDateTime } },
         { endDateTime: { gt: startDateTime } },
       ],
     },
   });
   ```
3. Dans `generateOccurrences`, appeler `findRoomConflicts` pour chaque occurrence. Si conflit → lever une erreur `ConflictError` avec détails (salle, dates en conflit).
4. Optionnel : permettre le mode `OVERWRITE` ou `SKIP` pour résoudre les conflits.

**Fichiers à modifier**
- `src/services/scheduling.ts`

**Tests**
- Tests unitaires : détecter un conflit, pas de faux positif.
- Tests d'intégration : générer un planning avec conflit → erreur 409.

**Estimation** : 1 jour.

---

### S3-05 — Ajouter les endpoints CRUD `Site`/`Room`

**Solution**
1. Créer `src/app/api/sites/route.ts` :
   - `GET` : liste des sites (avec pagination)
   - `POST` : créer un site (MANAGER / ADMIN)
2. Créer `src/app/api/sites/[id]/route.ts` :
   - `GET` : détail
   - `PATCH` : modifier
   - `DELETE` : supprimer (si pas de sessions liées)
3. Créer `src/app/api/rooms/route.ts` et `src/app/api/rooms/[id]/route.ts` avec le même pattern.
4. Ajouter `GET /api/sites/[id]/rooms` pour lister les salles d'un site.

**Fichiers à créer**
- `src/app/api/sites/route.ts`
- `src/app/api/sites/[id]/route.ts`
- `src/app/api/rooms/route.ts`
- `src/app/api/rooms/[id]/route.ts`

**Tests**
- Tests d'intégration : CRUD complet Site/Room.
- Tests RBAC : `USER` ne peut pas créer/modifier un site.

**Estimation** : 1,5 jour.

---

### S3-06 — Mettre à jour `TrainingSession` avec site/salle

**Solution**
1. Ajouter `siteId` et `roomId` à `TrainingSession` (créé en S3-01).
2. Mettre à jour le formulaire de création/édition de session pour sélectionner un site et une salle.
3. Si la session est récurrente, appliquer le site/salle à toutes les occurrences ou permettre la variation par occurrence.
4. Mettre à jour `src/services/trainingSessionCrud` pour inclure `site` et `room` dans les relations.

**Fichiers à modifier**
- `src/app/api/sessions/[id]/route.ts` (schéma de validation)
- `src/app/sessions/[id]/page.tsx` (UI)
- `src/lib/validations/session.ts`

**Tests**
- Tests d'intégration : créer une session avec site/salle → occurrences créées avec la bonne salle.
- Tests E2E : workflow de création de session avec site/salle.

**Estimation** : 1 jour.

---

### S3-07 — Tests E2E du planning et des conflits

**Objectif**
Vérifier que le modèle Site/Room, les occurrences récurrentes et la détection de conflits fonctionnent ensemble.

**Scénarios**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `sites-rooms-crud.spec.ts` | CRUD complet Site/Room | Opérations acceptées/refusées selon RBAC |
| `recurring-schedule.spec.ts` | Créer une session hebdomadaire sur 10 semaines | 10 occurrences générées |
| `room-conflicts.spec.ts` | Générer un planning qui chevauche une salle occupée | Erreur 409 avec détails du conflit |
| `recurring-schedule-advanced.spec.ts` | Récurrence avec jours spécifiques et exclusions | Occurrences correctes |

**Fichiers à créer / modifier**
- `e2e/sites-rooms-crud.spec.ts` (nouveau)
- `e2e/recurring-schedule.spec.ts` (nouveau)
- `e2e/room-conflicts.spec.ts` (nouveau)

**Estimation** : 1,5 jour.

---

## Ordre de traitement recommandé

```
Jour 1 : S3-01 (modèle Site/Room) + S3-02 (SessionOccurrence)
Jour 2 : S3-03 (service scheduling) — début
Jour 3 : S3-03 (suite) + S3-04 (conflits)
Jour 4 : S3-05 (API CRUD)
Jour 5 : S3-06 (intégration TrainingSession) — début
Jour 6 : S3-06 (suite) + début S3-07
Jour 7 : S3-07 (tests E2E)
Jour 8-9 : revue + corrections + merge
```

## Risques du sprint

| Risque | Mitigation |
|---|---|
| Performance des requêtes de conflit | Index composite sur `(roomId, startDateTime, endDateTime)`. |
| Complexité de l'algorithme de récurrence | Commencer par `WEEKLY` simple avant d'ajouter `MONTHLY` et exclusions. |
| S3-06 casse les sessions existantes | Rendre `siteId`/`roomId` nullable d'abord, puis migrer les données. |

## Livrables

1. `prisma/schema.prisma` mis à jour + migration.
2. `src/services/scheduling.ts` (nouveau service).
3. `src/app/api/sites/` et `src/app/api/rooms/` (nouveaux endpoints).
4. `src/app/api/sessions/[id]/schedule/route.ts` (nouveau).
5. UI : formulaires Site/Room et sélection dans Session.
6. Tests unitaires, d'intégration et E2E.
