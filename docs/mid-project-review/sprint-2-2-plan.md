# Sprint 2.2 — Clarification du modèle, import placement-test, statuts d'inscription

**Objectif** : fiabiliser le modèle de session, corriger l'import de tests de positionnement, et enrichir le cycle de vie des inscriptions.

**Durée estimée** : 1 semaine.

**Équipe suggérée** : 1 dev full-stack + 1 reviewer.

**Definition of Done** :
- Le modèle `TrainingSession` est clarifié (champs explicites, relations documentées).
- L'import CSV de tests de positionnement fonctionne et valide les données.
- Les inscriptions disposent de statuts finis avec transitions contrôlées.
- Les tests unitaires, d'intégration et E2E passent.

---

## Tâches du sprint

| ID | Titre | Type | Priorité | Complexité |
|---|---|---|---|---|
| S2-01 | Clarifier le modèle `TrainingSession` | Data | P0 | M |
| S2-02 | Corriger l'import de placement tests | Feature | P0 | M |
| S2-03 | Ajouter les statuts d'inscription (`EnrollmentStatus`) | Feature | P0 | M |
| S2-04 | Ajouter les transitions de statut d'inscription | Feature | P1 | M |
| S2-05 | Tests E2E du cycle de vie des inscriptions | Testing | P1 | S |

---

## Détail des tâches

### S2-01 — Clarifier le modèle `TrainingSession`

**État actuel**
Le modèle `TrainingSession` mêle plusieurs responsabilités : planning, tarification, logistique, état. Certains champs sont ambigus (`startDate` vs `actualStartDate`, `isOnline` vs `location`).

**Problème**
Difficulté à maintenir, risque d'incohérences entre sessions présentielles et distancielles, pas de distinction claire entre brouillon et session confirmée.

**Solution**
1. Documenter chaque champ dans `prisma/schema.prisma` avec des commentaires.
2. Ajouter des champs explicites si nécessaire :
   - `mode: SessionMode` (`PRESENTIAL`, `REMOTE`, `HYBRID`)
   - `status: SessionStatus` (`DRAFT`, `SCHEDULED`, `ONGOING`, `COMPLETED`, `CANCELLED`)
3. Déplacer les champs de logistique (site, salle) vers une future table `SessionLogistics` (Sprint 3).
4. Harmoniser les noms : `registrationStartDate` / `registrationEndDate` si manquants.

**Fichiers à modifier**
- `prisma/schema.prisma`
- `src/services/trainingSession.ts` (si logique métier dépend des champs)
- `src/lib/validations/session.ts` (schémas de validation)

**Tests**
- Tests de schéma Prisma : valider que les enums existent.
- Tests d'intégration : créer une session dans chaque mode/statut.

**Estimation** : 2 jours.

---

### S2-02 — Corriger l'import de placement tests

**État actuel**
`POST /api/sessions/[id]/import-enrollments` permet d'importer des inscriptions depuis CSV. Le mapping des colonnes est rigide et ne gère pas les tests de positionnement associés.

**Problème**
1. L'import ignore les colonnes de tests de positionnement.
2. Pas de validation des IDs de tests existants.
3. En cas d'erreur partielle, l'import continue sans rapport d'erreurs détaillé.

**Solution**
1. Mettre à jour le schéma d'import pour accepter des colonnes optionnelles :
   - `positioning_test_1_code`, `positioning_test_1_date`
   - `positioning_test_2_code`, `positioning_test_2_date`
2. Dans le service d'import (`src/services/imports.ts`) :
   - Créer les `PositioningTest` liés à la session si les colonnes sont présentes.
   - Lier chaque inscription au test correspondant si applicable.
   - Collecter les erreurs par ligne et retourner un rapport structuré.
3. Ajouter un endpoint `POST /api/sessions/[id]/import-positioning-tests` dédié si l'import est trop complexe.

**Fichiers à modifier**
- `src/app/api/sessions/[id]/import-enrollments/route.ts`
- `src/services/imports.ts`
- `src/lib/validations/imports.ts`

**Tests**
- Test d'intégration : CSV avec tests de positionnement → tests créés et liés.
- Test d'intégration : CSV invalide → rapport d'erreurs complet.
- Test d'intégration : ID de test inexistant → erreur ligne N.

**Estimation** : 2 jours.

---

### S2-03 — Ajouter les statuts d'inscription (`EnrollmentStatus`)

**État actuel**
Le modèle `Enrollment` n'a pas de champ de statut explicite. On infère l'état par la présence d'une `StudentGroup` ou de notes, ce qui est fragile.

**Problème**
Pas de visibilité sur le pipeline d'inscription : combien de dossiers en attente, confirmés, annulés, terminés ?

**Solution**
1. Ajouter un enum `EnrollmentStatus` dans Prisma :
   ```prisma
   enum EnrollmentStatus {
     PENDING
     CONFIRMED
     ACTIVE
     COMPLETED
     CANCELLED
     REJECTED
   }
   ```
2. Ajouter le champ `status EnrollmentStatus @default(PENDING)` à `Enrollment`.
3. Définir les règles de transition :
   - `PENDING` → `CONFIRMED` (paiement reçu / validation administrative)
   - `CONFIRMED` → `ACTIVE` (début de session)
   - `ACTIVE` → `COMPLETED` (fin de session avec succès)
   - N'importe quel état → `CANCELLED` / `REJECTED` (avec audit)
4. Ajouter `statusChangedAt` et `statusChangedBy` pour la traçabilité.

**Fichiers à modifier**
- `prisma/schema.prisma`
- `src/services/enrollment.ts` (transitions)
- `src/lib/api/resources.ts` (si besoin d'exposer le statut)

**Tests**
- Tests unitaires : chaque transition est autorisée/refusée selon les règles.
- Tests d'intégration : création d'inscription → statut `PENDING` par défaut.

**Estimation** : 1,5 jour.

---

### S2-04 — Ajouter les transitions de statut d'inscription

**État actuel**
Les statuts existent (S2-03) mais il n'y a pas de mécanisme centralisé pour les transitions. Chaque service peut modifier le statut arbitrairement.

**Problème**
Risque d'incohérence : un `USER` pourrait passer une inscription de `PENDING` à `COMPLETED` sans validation.

**Solution**
1. Créer `src/services/enrollmentStatus.ts` avec :
   ```ts
   export async function transitionEnrollmentStatus(
     db: Db,
     enrollmentId: string,
     newStatus: EnrollmentStatus,
     actorId: string,
     reason?: string,
   ): Promise<Enrollment>
   ```
2. Vérifier la transition autorisée selon une table de transitions :
   ```ts
   const ALLOWED_TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
     PENDING: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
     CONFIRMED: ['ACTIVE', 'CANCELLED'],
     ACTIVE: ['COMPLETED', 'CANCELLED'],
     COMPLETED: [],
     CANCELLED: [],
     REJECTED: [],
   };
   ```
3. Logger chaque transition dans `AuditLog`.
4. Exposer via API :
   - `POST /api/enrollments/[id]/status` (MANAGER / ADMIN uniquement pour la plupart des transitions).

**Fichiers à modifier**
- `src/services/enrollmentStatus.ts` (nouveau)
- `src/services/enrollment.ts`
- `src/app/api/enrollments/[id]/status/route.ts` (nouveau)

**Tests**
- Tests unitaires : transitions autorisées et refusées.
- Tests d'intégration : transition illégale → erreur 409.
- Tests d'intégration : transition légale → AuditLog créé.

**Estimation** : 1,5 jour.

---

### S2-05 — Tests E2E du cycle de vie des inscriptions

**Objectif**
Vérifier que le modèle clarifié, l'import de placement tests et les statuts d'inscription fonctionnent ensemble.

**Scénarios**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `session-modes.spec.ts` | Créer une session en chaque mode | Champs corrects, relations valides |
| `import-positioning.spec.ts` | Importer un CSV avec tests de positionnement | Tests créés, inscriptions liées |
| `enrollment-status.spec.ts` | Parcours complet PENDING → CONFIRMED → ACTIVE → COMPLETED | Transitions acceptées, audit tracé |
| `enrollment-status-cancel.spec.ts` | Annuler une inscription ACTIVE | Statut = CANCELLED, audit créé |

**Fichiers à créer / modifier**
- `e2e/session-modes.spec.ts` (nouveau)
- `e2e/import-positioning.spec.ts` (nouveau)
- `e2e/enrollment-status-lifecycle.spec.ts` (nouveau)

**Estimation** : 1 jour.

---

## Ordre de traitement recommandé

```
Jour 1 : S2-01 (clarification modèle)
Jour 2 : S2-01 (suite) + début S2-02
Jour 3 : S2-02 (import placement tests)
Jour 4 : S2-03 (statuts inscription)
Jour 5 : S2-04 (transitions)
Jour 6 : S2-05 (tests E2E)
Jour 7 : revue + corrections + merge
```

## Risques du sprint

| Risque | Mitigation |
|---|---|
| S2-01 casse des requêtes existantes | Lancer `prisma migrate dev` et vérifier toutes les queries. |
| S2-02 CSV complexe à parser | Limiter le périmètre aux cas les plus courants ; déporter les cas avancés. |
| S2-03/S2-04 changement de comportement | Garder `PENDING` comme valeur par défaut pour ne pas casser les inscriptions existantes. |

## Livrables

1. `prisma/schema.prisma` mis à jour + migration.
2. `src/services/enrollmentStatus.ts` (nouveau service).
3. `src/services/imports.ts` corrigé (placement tests).
4. `src/app/api/sessions/[id]/import-enrollments/route.ts` corrigé.
5. `src/app/api/enrollments/[id]/status/route.ts` (nouveau).
6. Tests unitaires, d'intégration et E2E.
7. `docs/decisions.md` mis à jour.
