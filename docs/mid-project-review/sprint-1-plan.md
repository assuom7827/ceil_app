# Sprint 1 — Critical Fixes

**Objectif** : corriger les failles de sécurité et les incohérences fonctionnelles bloquantes identifiées dans la mid-project review.

**Durée estimée** : 2 semaines.

**Équipe suggérée** : 2 développeurs full-stack + 1 reviewer.

**Definition of Done** :
- Toutes les tâches P0 de la phase 1 sont terminées et mergées.
- Les tests E2E de régression passent.
- Aucune régression fonctionnelle n'est introduite.

---

## Tâches du sprint

| ID | Titre | Type | Priorité | Complexité |
|---|---|---|---|---|
| S1-01 | Restreindre le rôle `USER` | Security | P0 | M |
| S1-02 | Empêcher `USER` d'écrire `AuditLog` | Security | P0 | S |
| S1-03 | Corriger l'IDOR sur `/api/sessions/[id]/attestation` | Security | P0 | S |
| S1-04 | Corriger l'IDOR sur `/api/sessions/[id]/certificates` | Security | P0 | S |
| S1-05 | Rendre l'audit transactionnel dans `enrollment.ts` | Security | P0 | M |
| S1-06 | Rendre l'audit transactionnel dans `locking.ts` | Security | P0 | S |
| S1-07 | Rendre l'audit transactionnel dans `groups.ts` | Security | P0 | M |
| S1-08 | Ajouter le rate limiting au login | Security | P0 | M |
| S1-09 | Vérifier que `enrollmentId` appartient à `positioningTestId` | Security | P0 | M |
| S1-10 | Tests E2E de régression RBAC / IDOR | Testing | P0 | M |

---

## Détail des tâches

### S1-01 — Restreindre le rôle `USER`

**État actuel**
`src/services/rbac.ts` définit `USER_READ_ONLY_RESOURCES = ['Training', 'TrainingLevel', 'PaymentReceipt']`. Un `USER` peut donc écrire sur toutes les autres ressources métier (`Faculty`, `Speciality`, `Teacher`, `StudentCategory`, `TrainingSession`, `StudentGroup`, `Enrollment`, `PositioningTest`, `PositioningScore`, `DeliberationEntry`, `Participant`, `DiplomaModel`).

**Problème**
Le rôle `USER` est supposé être l'agent métier qui saisit les données ; il ne doit pas pouvoir supprimer des ressources critiques, modifier les référentiels de base, ou écrire des notes sans contrôle.

**Solution**
1. Définir une liste `USER_WRITABLE_RESOURCES` restrictive :
   - `Enrollment` (saisie, affectation groupe)
   - `PositioningScore` (saisie notes positionnement)
   - `DeliberationEntry` (saisie notes délibération)
   - `Attendance` (à ajouter plus tard, mais réserver la ressource)
   - `PaymentReceipt` (saisie reçus)
2. Modifier `canWrite` pour que `USER` ne puisse écrire que sur ces ressources.
3. Retirer `Training`, `TrainingLevel`, `PaymentReceipt` de `USER_READ_ONLY_RESOURCES` (car `canWrite` va les interdire explicitement).
4. Mettre à jour `USER_READ_ONLY_RESOURCES` en `USER_WRITE_PROTECTED_RESOURCES` pour la lisibilité.

**Fichiers à modifier**
- `src/services/rbac.ts`

**Tests**
- Ajouter un test unitaire pour `canWrite` avec chaque ressource et rôle `USER`.
- Vérifier que `USER` ne peut plus `PATCH`/`DELETE` sur `Faculty`, `Teacher`, `TrainingSession`, `StudentGroup`, `Participant`, `PositioningTest`, `DeliberationEntry`.

**Estimation** : 1 jour.

---

### S1-02 — Empêcher `USER` d'écrire `AuditLog`

**État actuel**
`src/services/rbac.ts` ligne 65-70 :
```ts
export function canWrite(actor, resource) {
  if (!actor) return false;
  if (ADMIN_ONLY_RESOURCES.includes(resource)) return actor.role === 'ADMIN';
  if (hasFullAccess(actor.role)) return true;
  return !USER_READ_ONLY_RESOURCES.includes(resource);
}
```
`AuditLog` n'est pas dans `USER_READ_ONLY_RESOURCES`, donc `canWrite` retourne `true` pour `USER`.

**Problème**
Un utilisateur métier peut potentiellement écrire des faux logs d'audit.

**Solution**
- Ajouter `'AuditLog'` à `ADMIN_ONLY_RESOURCES` ou à une nouvelle liste `AUDIT_ONLY_RESOURCES`.
- Mettre à jour `canRead` si nécessaire (`AuditLog` est déjà réservé à `MANAGER`/`ADMIN`).

**Fichiers à modifier**
- `src/services/rbac.ts`

**Tests**
- Test unitaire : `canWrite({ role: 'USER' }, 'AuditLog') === false`.

**Estimation** : 0,5 jour.

---

### S1-03 — Corriger l'IDOR sur `/api/sessions/[id]/attestation`

**État actuel**
`src/app/api/sessions/[id]/attestation/route.ts` :
```ts
const enrollmentId = url.searchParams.get('enrollmentId') ?? undefined;
const built = await buildAttestationOdt(db, params.id, enrollmentId);
```
`buildAttestationOdt` (dans `src/services/certificates.ts`) reçoit `sessionId` et `enrollmentId`. Si `enrollmentId` est fourni, il ne vérifie pas que l'inscription appartient à la session.

**Problème**
Un utilisateur authentifié peut demander l'attestation d'une inscription d'une autre session en fournissant un `enrollmentId` arbitraire. C'est un IDOR (Insecure Direct Object Reference).

**Solution**
1. Si `enrollmentId` est fourni, vérifier dans la route (ou le service) que :
   ```ts
   const enrollment = await db.enrollment.findFirst({
     where: { id: enrollmentId, trainingSessionId: params.id },
     select: { id: true },
   });
   if (!enrollment) throw notFoundError('Inscription introuvable dans cette session.', { enrollmentId });
   ```
2. Idéalement, déplacer cette vérification dans `buildAttestationOdt` (service) pour qu'elle s'applique quel que soit l'appelant.

**Fichiers à modifier**
- `src/app/api/sessions/[id]/attestation/route.ts` (vérification préalable)
- `src/services/certificates.ts` (vérification dans `buildAttestationOdt`)

**Tests**
- E2E : `USER` essaie `GET /api/sessions/OTHER_SESSION_ID/attestation?enrollmentId=ENROLLMENT_FROM_SESSION_A` → 404.
- Test d'intégration : vérifier que le service retourne 404 si l'inscription n'appartient pas à la session.

**Estimation** : 0,5 jour.

---

### S1-04 — Corriger l'IDOR sur `/api/sessions/[id]/certificates`

**État actuel**
Même pattern que l'attestation. `buildCertificateOdt` reçoit `sessionId` et `enrollmentId` sans vérification d'appartenance.

**Problème**
Même IDOR, mais sur les attestations de réussite (données sensibles : admis/ajourné).

**Solution**
Même correctif que S1-03 :
1. Vérifier `enrollment.trainingSessionId === sessionId` avant génération.
2. Ajouter la vérification dans `buildCertificateOdt`.

**Fichiers à modifier**
- `src/app/api/sessions/[id]/certificates/route.ts`
- `src/services/certificates.ts`

**Tests**
- Même pattern que S1-03.

**Estimation** : 0,5 jour.

---

### S1-05 — Rendre l'audit transactionnel dans `enrollment.ts`

**État actuel**
`src/services/enrollment.ts` :

- `removeEnrollment` (ligne 219-244) : `logAudit` est appelé **avant** `db.enrollment.delete`, avec le client racine `db` (pas la transaction).
- `assignGroup` (ligne 247-289) : `logAudit` est appelé **après** `updateMany`, avec le client racine `db` (pas de transaction englobante).
- `createAndEnroll` et `enroll` utilisent `withTransaction` et appellent `logAudit` à l'intérieur : OK.

**Problème**
1. Si `logAudit` échoue après l'opération métier, l'opération a eu lieu mais n'est pas tracée (ou inversement).
2. Si une erreur survient pendant l'opération métier, l'audit peut avoir été déjà écrit.
3. `assignGroup` ne bénéficie pas d'une transaction englobante : deux appels simultanés peuvent dépasser la capacité.

**Solution**
1. `removeEnrollment` :
   - Déplacer `logAudit` **après** la suppression, **dans** une transaction.
   - Utiliser `withTransaction(db, async (tx) => { ... suppression ... logAudit(tx, ...) })`.
2. `assignGroup` :
   - Encapsuler toute la fonction dans `withTransaction(db, async (tx) => { ... })`.
   - Lire l'existant avec `tx`, effectuer les updates avec `tx`, logger avec `tx`.
   - Ajouter une vérification de capacité si le groupe a un champ `capacity`.

**Fichiers à modifier**
- `src/services/enrollment.ts`

**Tests**
- Test d'intégration : simuler un échec de logAudit (mock) et vérifier que l'opération métier est rollbackée.
- Test d'intégration : `assignGroup` simultané sur le même groupe (race condition).

**Estimation** : 1 jour.

---

### S1-06 — Rendre l'audit transactionnel dans `locking.ts`

**État actuel**
`src/services/locking.ts` :

- `setSessionState` (ligne 64-89) : lit l'état, met à jour, puis logue avec `db` racine.
- `setPositioningTestState` (ligne 119-144) : même pattern.

**Problème**
Même incohérence : si `logAudit` échoue, l'état est changé mais non tracé. Si l'update échoue, l'audit a déjà été écrit.

**Solution**
1. `setSessionState` :
   ```ts
   return withTransaction(db, async (tx) => {
     const previous = await tx.trainingSession.findUnique({ where: { id: trainingSessionId }, select: { state: true } });
     const updated = await tx.trainingSession.update({ where: { id: trainingSessionId }, data: { state } });
     if (actorId && previous?.state !== state) {
       await logAudit(tx, {
         actorId,
         action: state === 'LOCKED' ? ACTION_SESSION_LOCKED : ACTION_SESSION_UNLOCKED,
         entityType: 'TrainingSession',
         entityId: trainingSessionId,
         oldValue: { state: previous?.state },
         newValue: { state: updated.state },
       });
     }
     return updated;
   });
   ```
2. Même chose pour `setPositioningTestState`.
3. Supprimer la double lecture dans `setSessionState` (ligne 70 appelle `getSessionState`, puis ligne 71 relit) : une seule lecture dans la transaction suffit.

**Fichiers à modifier**
- `src/services/locking.ts`

**Tests**
- Test d'intégration : verrouillage puis déverrouillage, vérifier qu'un seul `AuditLog` est créé par opération.
- Test d'intégration : simuler échec logAudit → vérifier rollback.

**Estimation** : 0,5 jour.

---

### S1-07 — Rendre l'audit transactionnel dans `groups.ts`

**État actuel**
`src/services/groups.ts` : `organizeGroups`, `organizeGroupsByLevel`, `assignGroupsByLevel`, `assignExamGroups` n'appellent **jamais** `logAudit`. La suppression/recréation massive de groupes et l'affectation massive ne laissent aucune trace.

**Problème**
Pas de traçabilité des opérations de groupe, ce qui est critique pour un audit opposable.

**Solution**
1. Ajouter des constantes d'action dans `groups.ts` :
   ```ts
   export const ACTION_GROUPS_ORGANIZED = 'GROUPS_ORGANIZED';
   export const ACTION_GROUPS_ASSIGNED_BY_LEVEL = 'GROUPS_ASSIGNED_BY_LEVEL';
   export const ACTION_EXAM_GROUPS_ASSIGNED = 'EXAM_GROUPS_ASSIGNED';
   ```
2. Dans chaque fonction, logger **à la fin** de la transaction, avec :
   - `actorId`
   - `entityType: 'StudentGroup'`
   - `entityId: trainingSessionId` (ou IDs des groupes créés)
   - `oldValue` / `newValue` pertinents (liste des groupes supprimés, etc.)
3. Encapsuler dans `withTransaction` si ce n'est pas déjà fait (`organizeGroups` et `organizeGroupsByLevel` le font déjà ; `assignGroupsByLevel` et `assignExamGroups` le font aussi).

**Fichiers à modifier**
- `src/services/groups.ts`

**Tests**
- Test d'intégration : après `organizeGroupsByLevel`, vérifier qu'un `AuditLog` est créé.
- Test d'intégration : après `assignGroupsByLevel`, vérifier l'audit.

**Estimation** : 1 jour.

---

### S1-08 — Ajouter le rate limiting au login

**État actuel**
`src/auth.ts` : le provider `Credentials` ne comporte aucune limitation de tentatives. `src/middleware.ts` est minimal.

**Problème**
Un attaquant peut brute-forcer les mots de passe sans limite.

**Solution**
Deux approches possibles (à choisir selon l'infrastructure) :

**Approche A — Middleware Next.js (recommandé si edge-compatible)**
Utiliser un middleware qui :
- Lit un en-tête ou cookie de tentatives échouées.
- Bloque après N échecs avec un `429 Too Many Requests`.
- Nécessite un stockage en mémoire ou Redis.

**Approche B — Reverse proxy (nginx/Caddy)**
- Configurer le reverse proxy pour limiter le débit sur `/api/auth/callback/credentials`.
- Exemple nginx : `limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;`.

**Approche C — Bibliothèque Next.js compatible edge**
- `@upstash/ratelimit` ou `lru-cache` en mémoire (attention au multi-instances).

Pour le sprint, proposer l'**Approche B** (documentée dans le README) + une implementationOption B (documentation + exemple nginx).

Si l'équipe préfère une solution applicative, implémenter un middleware simple avec `lru-cache` en mémoire, avec pour limite 5 échecs par IP par 15 minutes.

**Fichiers à modifier**
- `src/middleware.ts` (si approche applicative)
- `docs/reverse-proxy-nginx.md` + `docs/reverse-proxy-caddy.md` (approche infra)

**Tests**
- Test manuel : 6 échecs de login → 429 au 6e.
- Test d'intégration si middleware applicatif.

**Estimation** : 1 jour.

---

### S1-09 — Vérifier que `enrollmentId` appartient à `positioningTestId`

**État actuel**
`src/services/positioning.ts` ligne 273-294 :
```ts
export async function upsertPositioningScore(db, positioningTestId, enrollmentId, values, actorId) {
  await assertPositioningTestWritable(db, positioningTestId);
  const previous = await db.positioningScore.findUnique({ where: { enrollmentId } });
  const updated = await db.positioningScore.upsert({
    where: { enrollmentId },
    update: values,
    create: { enrollmentId, positioningTestId, ...values },
  });
  ...
}
```

**Problème**
- `findUnique` par `enrollmentId` retourne un score existant, quel que soit le `positioningTestId`.
- `upsert` met à jour les notes sans vérifier que le score appartient bien au test passé en paramètre.
- Un utilisateur peut modifier les notes d'une inscription rattachée à un autre test.

**Solution**
1. Vérifier l'appartenance avant l'upsert :
   ```ts
   const existing = await db.positioningScore.findUnique({
     where: { enrollmentId },
     select: { id: true, positioningTestId: true },
   });
   if (existing && existing.positioningTestId !== positioningTestId) {
     throw conflictError('Ce score appartient à un autre test de positionnement.', {
       enrollmentId,
       expectedTestId: positioningTestId,
       actualTestId: existing.positioningTestId,
     });
   }
   ```
2. Si `existing` est null, la création utilise bien `positioningTestId` fourni : OK.

**Fichiers à modifier**
- `src/services/positioning.ts`

**Tests**
- Test d'intégration : créer deux tests, saisir une note pour le test A, tenter de modifier via l'ID du test B → 409.
- E2E : scénario cross-test.

**Estimation** : 0,5 jour.

---

### S1-10 — Tests E2E de régression RBAC / IDOR

**Objectif**
Vérifier que les correctifs ne cassent pas le workflow existant et que les nouvelles protections sont effectives.

**Scénarios à ajouter dans `e2e/`**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `rbac-user-delete.spec.ts` | `USER` tente de supprimer une session | 403 |
| `rbac-user-delete.spec.ts` | `USER` tente de supprimer un participant | 403 |
| `rbac-user-audit.spec.ts` | `USER` tente d'écrire un AuditLog (si endpoint exposé) | 403 |
| `idor-attestation.spec.ts` | `USER` demande attestation d'une autre session | 404 |
| `idor-certificate.spec.ts` | `USER` demande certificat d'une autre session | 404 |
| `positioning-cross-test.spec.ts` | Saisie note cross-test refusée | 409 |
| `journey.spec.ts` (existant) | Rejouer le parcours complet | Passant |

**Fichiers à modifier / créer**
- `e2e/rbac-user-delete.spec.ts` (nouveau)
- `e2e/idor-documents.spec.ts` (nouveau)
- `e2e/positioning-cross-test.spec.ts` (nouveau)

**Estimation** : 1,5 jour.

---

## Ordre de traitement recommandé

```
Jour 1 : S1-01 (RBAC USER) + S1-02 (AuditLog)
Jour 2 : S1-03 + S1-04 (IDOR documents)
Jour 3 : S1-05 (audit enrollment)
Jour 4 : S1-06 (audit locking) + S1-07 (audit groups)
Jour 5 : S1-09 (cross-test)
Jour 6 : S1-08 (rate limiting) + début S1-10
Jour 7-10 : S1-10 (tests E2E) + revue + corrections
```

## Risques du sprint

| Risque | Mitigation |
|---|---|
| S1-01 casse l'UI existante (boutons still visible) | Vérifier que l'UI désactive bien les actions ; le RBAC est serveur mais l'UI doit être cohérente. |
| S1-08 dépend de l'infra (reverse proxy) | Prévoir une solution applicative de repli. |
| S1-10 nécessite une base de test stable | Utiliser `db:reset` + seed dédié pour les specs e2e. |
| S1-05/S1-06 changent le comportement transactionnel | Vérifier qu'aucun code ne dépend d'un audit pré-opération. |

## Livrables

1. `src/services/rbac.ts` corrigé.
2. `src/app/api/sessions/[id]/attestation/route.ts` corrigé.
3. `src/app/api/sessions/[id]/certificates/route.ts` corrigé.
4. `src/services/enrollment.ts` corrigé (audit transactionnel).
5. `src/services/locking.ts` corrigé (audit transactionnel).
6. `src/services/groups.ts` corrigé (audit transactionnel).
7. `src/services/positioning.ts` corrigé (cross-test).
8. `src/middleware.ts` ou documentation reverse proxy pour rate limiting.
9. 3 nouveaux fichiers e2e + mise à jour du journey si besoin.
10. `docs/decisions.md` mis à jour avec les choix de ce sprint.
