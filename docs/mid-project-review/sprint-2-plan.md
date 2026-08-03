# Sprint 2 — Délégation de sessions de formation

**Objectif** : permettre au `MANAGER` de déléguer une session à un ou plusieurs agents de saisie (`USER`), et restreindre l'accès à l'espace de travail de la session aux seuls agents délégués.

**Durée estimée** : 1 semaine.

**Équipe suggérée** : 1 dev full-stack + 1 reviewer.

**Definition of Done** :
- Toutes les tâches du sprint sont terminées et mergées.
- Les tests d'intégration et E2E passent.
- Aucune régression fonctionnelle n'est introduite.
- Les `USER` existants perdent l'accès aux sessions non déléguées (procédure de migration respectée).

---

## Problème actuel

Aujourd'hui, toute personne authentifiée avec le rôle `USER` peut :
- Lire la liste de toutes les sessions (`GET /api/sessions`)
- Accéder à n'importe quelle session par son ID (`GET /api/sessions/[id]`)
- Modifier une session (inscriptions, notes, groupes, documents…)

Il n'existe aucun mécanisme de **portée par session**. Un agent de saisie voit et peut modifier toutes les sessions du système, ce qui est excessif et risqué.

---

## Règles métier

| Règle | Description |
|---|---|
| **Délégation MANAGER → USER** | Un `MANAGER` peut associer un ou plusieurs `USER` à une `TrainingSession`. |
| **Accès restreint** | Un `USER` ne peut accéder (lecture/écriture) qu'aux sessions qui lui sont déléguées. |
| **Accès total MANAGER** | Un `MANAGER` conserve un accès illimité à toutes les sessions. |
| **Accès total ADMIN** | Un `ADMIN` conserve un accès illimité à toutes les sessions. |
| **Hors délégation = 403** | Si un `USER` tente d'accéder à une session qui ne lui est pas déléguée → `403 Forbidden`. |
| **Délégation révocable** | Le `MANAGER` peut ajouter ou retirer des agents à tout moment. |
| **Portée d'écriture** | Un agent délégué (`USER`) peut modifier les champs de données des `Participant` de la session déléguée. |
| **Audit** | Chaque ajout/retrait de délégation est tracé dans `AuditLog`. |

---

## Modèle de données

### Nouvelle table : `SessionAgent`

```prisma
model SessionAgent {
  id               String    @id @default(cuid())
  trainingSessionId String
  userId           String
  assignedAt       DateTime  @default(now())
  assignedBy       String?   // userId du MANAGER qui a délégué

  trainingSession TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Cascade)
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([trainingSessionId, userId])
  @@index([userId])
  @@index([trainingSessionId])
  @@map("session_agents")
}
```

### Modifications du modèle `User`

```prisma
model User {
  // ... champs existants ...

  delegatedSessions SessionAgent[]
}
```

### Modifications du modèle `TrainingSession`

```prisma
model TrainingSession {
  // ... champs existants ...

  agents SessionAgent[]
}
```

**Migration** : `prisma migrate dev --name add-session-agents`

---

## RBAC — modifications

### `src/services/rbac.ts`

Ajouter une dépendance à la base de données pour vérifier la délégation :

```ts
export async function canReadSession(
  actor: Actor | null | undefined,
  db: Db,
  trainingSessionId: string,
): Promise<boolean> {
  if (!actor) return false;
  if (hasFullAccess(actor.role)) return true; // MANAGER / ADMIN

  // USER : vérifier la délégation
  const delegation = await db.sessionAgent.findFirst({
    where: { trainingSessionId, userId: actor.id },
    select: { id: true },
  });
  return !!delegation;
}

export async function canWriteSession(
  actor: Actor | null | undefined,
  db: Db,
  trainingSessionId: string,
): Promise<boolean> {
  if (!actor) return false;
  if (hasFullAccess(actor.role)) return true; // MANAGER / ADMIN
  // USER : même logique que canRead pour l'écriture
  return canReadSession(actor, db, trainingSessionId);
}
```

> **Note** : `canRead` et `canWrite` globaux (sans `db`) restent inchangés pour les autres ressources. Seules les vérifications sur `TrainingSession` deviennent asynchrones et dépendantes de la délégation.

---

## Services — modifications

### `src/services/locking.ts`

`assertSessionWritable` doit vérifier la délégation avant de vérifier l'état :

```ts
export async function assertSessionWritable(
  db: Db,
  trainingSessionId: string,
  actorId: string,
  actorRole: Role,
): Promise<void> {
  if (!hasFullAccess(actorRole)) {
    const delegated = await db.sessionAgent.findFirst({
      where: { trainingSessionId, userId: actorId },
    });
    if (!delegated) {
      throw forbiddenError("Vous n'êtes pas délégué sur cette session.", {
        trainingSessionId,
      });
    }
  }

  if ((await getSessionState(db, trainingSessionId)) === 'LOCKED') {
    throw lockedError('...');
  }
}
```

Tous les services qui appellent `assertSessionWritable` doivent transmettre `actor.id` et `actor.role` :
- `src/services/enrollment.ts`
- `src/services/deliberation.ts`
- `src/services/groups.ts`
- `src/services/imports.ts`

### `src/services/audit.ts`

Ajouter les actions d'audit pour la délégation :

```ts
export const ACTION_SESSION_AGENT_ADDED = 'SESSION_AGENT_ADDED';
export const ACTION_SESSION_AGENT_REMOVED = 'SESSION_AGENT_REMOVED';
```

### Nouveau service : `src/services/delegation.ts`

```ts
export async function delegateSession(
  db: Db,
  trainingSessionId: string,
  userId: string,
  actorId: string,
): Promise<void>

export async function undelegateSession(
  db: Db,
  trainingSessionId: string,
  userId: string,
  actorId: string,
): Promise<void>

export async function getSessionAgents(
  db: Db,
  trainingSessionId: string,
): Promise<Array<{ id: string; userId: string; userName: string; userEmail: string }>>

export async function getUserDelegatedSessions(
  db: Db,
  userId: string,
): Promise<string[]> // IDs de sessions
```

---

## API — nouveaux endpoints

### `POST /api/sessions/[id]/agents`

Délègue un agent à la session.

**Sécurité** : `MANAGER` / `ADMIN` uniquement.

```ts
export const POST = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'write' },
  async ({ db, params, actor, request }) => {
    const { userId } = await readJson(request, { parse: (v) => ({ userId: String(v.userId) }) });
    await delegateSession(db, params.id, userId, actor.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  },
);
```

### `DELETE /api/sessions/[id]/agents`

Retire la délégation d'un agent.

```ts
export const DELETE = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'write' },
  async ({ db, params, actor, request }) => {
    const { userId } = await readJson(request, { parse: (v) => ({ userId: String(v.userId) }) });
    await undelegateSession(db, params.id, userId, actor.id);
    return new NextResponse(null, { status: 204 });
  },
);
```

### `GET /api/sessions/[id]/agents`

Liste les agents délégués à la session.

```ts
export const GET = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'read' },
  async ({ db, params }) => {
    return getSessionAgents(db, params.id);
  },
);
```

---

## API — modifications existantes

### `GET /api/sessions` (collection)

Actuellement, `trainingSessionCrud` retourne toutes les sessions. Deux options :

**Option A — filtre côté service (recommandé)** :
Ajouter un `listFilter` dans `trainingSessionCrud` :

```ts
export const trainingSessionCrud: CrudConfig<Record<string, unknown>> = {
  // ...
  listFilter: (actor, query) => {
    if (hasFullAccess(actor.role)) return {}; // MANAGER / ADMIN voient tout
    return { agents: { some: { userId: actor.id } } }; // USER : sessions déléguées seulement
  },
};
```

**Option B — endpoint séparé** :
Créer `GET /api/my-sessions` pour les `USER`.

> L'option A est préférée : pas de duplication, la liste est automatiquement filtrée.

### `GET /api/sessions/[id]` (détail)

Le handler `itemRoutes` appelle `findUnique` sans vérifier la délégation. Remplacer le `GET` par un handler personnalisé :

```ts
export const GET = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'read' },
  async ({ db, params, actor }) => {
    const session = await db.trainingSession.findUnique({
      where: { id: params.id },
      include: { ...trainingSessionCrud.include },
    });
    if (!session) throw notFoundError('Session de formation introuvable.', { id: params.id });

    if (!hasFullAccess(actor.role)) {
      const delegated = await db.sessionAgent.findFirst({
        where: { trainingSessionId: params.id, userId: actor.id },
      });
      if (!delegated) {
        throw forbiddenError("Vous n'avez pas accès à cette session.", {
          trainingSessionId: params.id,
        });
      }
    }

    return session;
  },
);
```

Même logique pour tous les endpoints enfants (`/lock`, `/unlock`, `/enroll`, `/deliberation`, `/certificates`, `/attestation`, `/groups/*`, `/import-enrollments`, `/export`, `/positioning`, `/assign-group`).

> Pour éviter la duplication, créer une fonction `assertSessionAccess(db, trainingSessionId, actor)` dans `src/services/locking.ts` et l'appeler dans chaque route.

---

## UI — modifications

### Navigation

L'entrée `/sessions` reste visible pour tous les rôles (car `canRead(TrainingSession)` est `true` pour tout authentifié). En revanche :
- `MANAGER` / `ADMIN` voient la liste complète.
- `USER` ne voit que les sessions déléguées.

### Écran de détail d'une session

Ajouter un bouton **« Déléguer »** visible uniquement pour `MANAGER` / `ADMIN` :
- Ouvre un dialogue de sélection d'agents (`USER` actifs)
- Affiche la liste des agents déjà délégués avec un bouton de retrait

### Écran de liste des sessions

Pour `USER` : afficher uniquement les sessions déléguées. Ajouter un badge « Délégué » si pertinent.

---

## Tests

### Tests unitaires

| Test | Description |
|---|---|
| `canReadSession` avec `MANAGER` | Retourne `true` pour toute session |
| `canReadSession` avec `ADMIN` | Retourne `true` pour toute session |
| `canReadSession` avec `USER` délégué | Retourne `true` |
| `canReadSession` avec `USER` non délégué | Retourne `false` |

### Tests d'intégration

| Test | Description |
|---|---|
| `GET /api/sessions` en `USER` | Ne retourne que les sessions déléguées |
| `GET /api/sessions/OTHER` en `USER` non délégué | 403 |
| `POST /api/sessions/[id]/enroll` en `USER` délégué | 200 |
| `POST /api/sessions/[id]/enroll` en `USER` non délégué | 403 |
| `POST /api/sessions/[id]/agents` en `MANAGER` | 201 + AuditLog créé |
| `DELETE /api/sessions/[id]/agents` en `USER` | 403 |

### Tests E2E

| Scénario | Description |
|---|---|
| `delegation-flow.spec.ts` | MANAGER délègue une session à un USER → USER peut inscrire/éditer → MANAGER retire → USER perd l'accès |

---

## Plan de migration

1. **Générer la migration Prisma** : `prisma migrate dev --name add-session-agents`
2. **Backfill** : aucune donnée existante à migrer (la table est vide au départ).
3. **Déploiement** :
   - Tous les `USER` existants perdent l'accès à toutes les sessions jusqu'à délégation explicite.
   - **Action requise post-déploiement** : le `MANAGER` doit déléguer les sessions aux agents concernés.

---

## Risques

| Risque | Mitigation |
|---|---|
| Blocage total des `USER` après déploiement | Procédure de déploiement : déléguer les sessions AVANT de activer la vérification (feature flag ou déploiement progressif). |
| Performance : jointure supplémentaire sur chaque requête de session | Index sur `(trainingSessionId, userId)` dans `SessionAgent`. |
| Complexité des routes enfants | Factoriser `assertSessionAccess` dans un service partagé. |

---

## Ordre de traitement recommandé

```
Jour 1 :
  - Migration Prisma + modèle
  - Service delegation.ts (CRUD + audit)
  - Tests unitaires RBAC session

Jour 2 :
  - assertSessionAccess dans locking.ts
  - Mise à jour enrollment.ts, deliberation.ts, groups.ts, imports.ts
  - listFilter sur trainingSessionCrud

Jour 3 :
  - Routes API /agents (CRUD)
  - Modification GET /api/sessions/[id]
  - Modification routes enfants (lock, unlock, enroll, etc.)

Jour 4 :
  - UI : dialogue de délégation
  - UI : badge sur liste sessions
  - Tests d'intégration

Jour 5 :
  - Tests E2E
  - Revue + corrections
```

---

## Livrables

1. `prisma/schema.prisma` mis à jour + migration.
2. `src/services/delegation.ts` (nouveau service).
3. `src/services/rbac.ts` mis à jour avec `canReadSession` / `canWriteSession`.
4. `src/services/locking.ts` mis à jour avec `assertSessionAccess`.
5. `src/services/enrollment.ts`, `deliberation.ts`, `groups.ts`, `imports.ts` adaptés.
6. `src/lib/api/resources.ts` : `listFilter` sur `trainingSessionCrud`.
7. `src/app/api/sessions/[id]/agents/route.ts` (nouveau).
8. `src/app/api/sessions/[id]/route.ts` : handler personnalisé pour GET.
9. Composants UI : dialogue de délégation, badge sessions.
10. Tests unitaires, d'intégration et E2E.
