# Architecture Review — CEIL

## 1. Architecture actuelle

### Stack

| Domaine | Technologie |
|---|---|
| Framework | Next.js 15 (App Router, React Server Components) |
| Langage | TypeScript strict |
| Base de données | PostgreSQL 16 |
| ORM | Prisma 6 |
| Authentification | Auth.js v5 (NextAuth), credentials + JWT |
| UI | Tailwind CSS 3, shadcn/ui (Radix), lucide-react |
| Grilles | TanStack Table |
| i18n | next-intl (cookie `NEXT_LOCALE`) |
| Validation | Zod |
| Tests | Vitest (unit/inté), Playwright (e2e) |

### Organisation des couches

```text
UI (Composants clients)  ────────►  API (Route Handlers)
          │                              │
          ▼                              ▼
   services/derive.ts              lib/api/handler.ts
          │                              │
          └────────►  services/*  ◄──────┘
                          │
                          ▼
                    Prisma / PostgreSQL
```

### Modèle de données (vue d'ensemble)

* 16 modèles, 9 enums.
* CUID comme identifiant principal.
* `disabled` comme soft-disable.
* `AuditLog` pour tracer les actions.
* `SequenceCounter` pour l'allocation atomique de matricules.
* Principe fondateur : **aucune valeur dérivée stockée**.

## 2. Points forts de l'architecture

* **Séparation des responsabilités** : services métier purs, API wrapper, UI générique.
* **Testabilité** : `derive.ts` et `odt.ts` sans dépendance externe.
* **Cohérence des erreurs** : `ServiceError` + wrapper API.
* **Transactions** : `withTransaction` abstrait l'usage transactionnel.
* **Auditabilité** : intention d'audit logué, bien que partiel.
* **Documents ODT téléversables** : séparation mise en page / données.

## 3. Problèmes d'architecture

### 3.1 Modèle de données

| Problème | Impact | Recommandation |
|---|---|---|
| `TrainingSession.trainingLevelId` en contradiction avec la session multi-niveaux | Incohérence fonctionnelle majeure | Supprimer `trainingLevelId` si multi-niveaux est confirmé ; sinon rendre obligatoire. |
| `Speciality` sans FK | Référentiel inutilisé | Relier à `Participant` ou supprimer. |
| Absence de `Room`, `Site`, `ScheduleEntry`, `Attendance` | Pas de planning ni suivi pédagogique | Ajouter ces entités. |
| Absence de `Pricing` | Pas de tarification | Ajouter `Pricing` et solde d'inscription. |
| Absence de `GeneratedDocument` | Pas d'historique d'émission | Ajouter une entité de traçabilité. |
| `PositioningTest` lié à `Training` et non à `TrainingSession` | Pas de version annuelle | Ajouter un lien optionnel à `TrainingSession` ou cloner. |
| `PaymentReceipt` lié participant/session, pas directement à `Enrollment` | Soldes par inscription difficiles | Ajouter `enrollmentId` optionnel. |

### 3.2 RBAC

* `USER` excessivement permissif.
* `CrudDelegate` typé en `unknown` : perte de sécurité de type.
* Pas de vérification de portée.
* `AuditLog` écrivable par `USER` (bug de cohérence).

### 3.3 Qualité et maintenabilité

* Duplication de requêtes dans `locking.ts` et `documents.ts`.
* `public?: boolean` dans `handler.ts` non utilisé.
* Pas de normalisation des actions d'audit.
* Validation des notes trop permissive (max 1000).
* Gestion des dates sensible au fuseau (`derive.ts`).

### 3.4 Scalabilité

* `EditableGrid` maintient un cache manuel de colonnes pour éviter le remontage : bon pour les performances actuelles mais complexe.
* Génération PDF via LibreOffice : opération bloquante potentielle ; à surveiller pour les gros lots.
* Pas de cache côté serveur pour les référentiels.

## 4. Architecture cible recommandée

### 4.1 Conserver

* Next.js 15 App Router + RSC/CC.
* Prisma + PostgreSQL.
* Auth.js credentials + JWT.
* shadcn/ui + Tailwind.
* `services/derive.ts` comme source de vérité des calculs.
* Wrapper API + fabrique CRUD.
* Tests Vitest + Playwright.

### 4.2 Améliorer

* **RBAC** : restreindre `USER`, corriger `AuditLog`, ajouter vérification de portée si nécessaire.
* **Modèle de données** : clarifier session mono/multi-niveaux ; ajouter `Room`, `Site`, `ScheduleEntry`, `Attendance`, `Pricing`, `PricingTier`, `GeneratedDocument`, `AcquiredLevel`, `Notification`.
* **Validation** : lier les barèmes à `TrainingLevel`/`TrainingSession`, bornes de notes, dates cohérentes.
* **Audit** : transactions, IP, action normalisée, purge.
* **Soft-delete** : `deletedAt`/`deletedBy` sur les entités métier.
* **Uploads** : limits, hashing de nom, antivirus si dispo.

### 4.3 Refactorer

* `CrudDelegate` typage fort.
* `locking.ts` : une seule requête pour lire + mettre à jour l'état.
* `documents.ts` : inclure naissances dans `getDeliberation` si possible.
* `imports.ts` : gérer les doublons de matricule et créer les `PositioningScore` manquants.
* `rbac.ts` : nettoyer `USER_READ_ONLY_RESOURCES` et `canWrite`.

### 4.4 Remplacer

* Aucune réécriture complète n'est nécessaire.

### 4.5 Supprimer

* `papaparse` (inutilisé).
* `TrainingSession.trainingLevelId` si multi-niveaux confirmé.
* `Speciality` si non utilisé.

## 5. Schéma cible simplifié (ajouts)

```prisma
model Site {
  id        String   @id @default(cuid())
  name      String   @unique
  address   String?
  rooms     Room[]
  disabled  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Room {
  id        String   @id @default(cuid())
  name      String
  capacity  Int?
  siteId    String
  site      Site     @relation(fields: [siteId], references: [id])
  groups    StudentGroup[]
  disabled  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([siteId, name])
}

model ScheduleEntry {
  id            String      @id @default(cuid())
  groupId       String
  group         StudentGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  roomId        String?
  room          Room?       @relation(fields: [roomId], references: [id], onDelete: SetNull)
  dayOfWeek     Int         // 0 = dimanche, 6 = samedi
  startTime     String      // HH:mm
  endTime       String      // HH:mm
  effectiveFrom DateTime?
  effectiveTo   DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model Attendance {
  id          String    @id @default(cuid())
  scheduleEntryId String
  scheduleEntry ScheduleEntry @relation(fields: [scheduleEntryId], references: [id], onDelete: Cascade)
  enrollmentId String
  enrollment  Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  status      AttendanceStatus // PRESENT, ABSENT, LATE, JUSTIFIED
  recordedAt  DateTime  @default(now())
  recordedById String
  note        String?

  @@unique([scheduleEntryId, enrollmentId])
}

model Pricing {
  id              String         @id @default(cuid())
  trainingId      String
  training        Training       @relation(fields: [trainingId], references: [id], onDelete: Cascade)
  trainingLevelId String?
  trainingLevel   TrainingLevel? @relation(fields: [trainingLevelId], references: [id], onDelete: SetNull)
  categoryId      String?
  category        StudentCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  amount          Decimal        @db.Decimal(10, 2)
  academicYear    String
  disabled        Boolean        @default(false)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model GeneratedDocument {
  id            String             @id @default(cuid())
  kind          DocumentTemplateKind
  enrollmentId  String?
  enrollment    Enrollment?        @relation(fields: [enrollmentId], references: [id], onDelete: SetNull)
  sessionId     String?
  session       TrainingSession?   @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  fileName      String
  generatedAt   DateTime           @default(now())
  generatedById String
  contentHash   String?
  metadata      Json?
}

model EnrollmentStatusLog {
  id           String @id @default(cuid())
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  fromStatus   String?
  toStatus     String
  reason       String?
  changedById  String
  changedAt    DateTime @default(now())
}
```

## 6. Changements de base de données nécessaires avant production

### Critiques (P0)

1. Clarifier `TrainingSession.trainingLevelId` (supprimer ou obligatoire).
2. Ajouter `@@unique([trainingSessionId, groupType, name])` sur `StudentGroup`.
3. Ajouter `Enrollment.status` et `EnrollmentStatusLog`.
4. Ajouter `Room`, `Site`, `ScheduleEntry`, `Attendance`.
5. Ajouter `Pricing`.

### Importants (P1)

6. Soft-delete (`deletedAt`, `deletedById`) sur les entités métier.
7. Table `GeneratedDocument`.
8. Contrainte `minimumPoints < maximumPoints` sur `TrainingLevel`.
9. `PaymentReceipt.enrollmentId` optionnel.
10. `PositioningTest.trainingSessionId` optionnel.

### Secondaires (P2/P3)

11. `Setting` pour les paramètres globaux.
12. `Notification` pour les relances.
13. `AcquiredLevel` pour l'historique académique.
14. `Participant.address`, `documentNumber`, photo.

## 7. Hypothèses

* L'application restera hébergée sur une instance unique Next.js + PostgreSQL.
* Le CEIL confirmera que les sessions sont multi-niveaux.
* LibreOffice restera une dépendance acceptable pour l'attestation de réussite.
