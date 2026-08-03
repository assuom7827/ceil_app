# Sprint 5 — Tarification, paiements et exports financiers

**Objectif** : implémenter la gestion des tarifs, le suivi des paiements, les balances et les exports financiers.

**Durée estimée** : 2 semaines.

**Équipe suggérée** : 1 dev full-stack + 1 reviewer.

**Definition of Done** :
- Chaque session peut avoir un tarif défini par niveau, catégorie ou groupe.
- Les paiements sont enregistrés et associés à une inscription.
- Les balances (reste à payer, trop-perçu) sont calculées automatiquement.
- Les exports financiers (CSV, Excel, PDF) sont disponibles.
- Les tests unitaires, d'intégration et E2E passent.

---

## Tâches du sprint

| ID | Titre | Type | Priorité | Complexité |
|---|---|---|---|---|
| S5-01 | Ajouter le modèle `PricingRule` et `Payment` | Data | P0 | M |
| S5-02 | Créer le service de tarification | Feature | P0 | M |
| S5-03 | Créer le service de paiement | Feature | P0 | M |
| S5-04 | Calculer la balance par inscription | Feature | P0 | M |
| S5-05 | Ajouter les endpoints API de paiement | API | P0 | M |
| S5-06 | Implémenter les exports financiers | Feature | P1 | M |
| S5-07 | Tests E2E du workflow financier | Testing | P1 | M |

---

## Détail des tâches

### S5-01 — Ajouter le modèle `PricingRule` et `Payment`

**Solution**
1. Ajouter les modèles Prisma :
   ```prisma
   model PricingRule {
     id                String    @id @default(cuid())
     trainingSessionId String
     studentCategoryId String?   // si prix par catégorie
     trainingLevelId   String?   // si prix par niveau
     studentGroupId    String?   // si prix par groupe
     amount            Float     // prix unitaire HT ou TTC
     currency          String    @default("EUR")
     taxRate           Float     @default(0) // TVA en %
     createdAt         DateTime  @default(now())
     updatedAt         DateTime  @updatedAt

     trainingSession   TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Cascade)
     studentCategory   StudentCategory? @relation(fields: [studentCategoryId], references: [id])
     trainingLevel     TrainingLevel?   @relation(fields: [trainingLevelId], references: [id])
     studentGroup      StudentGroup?    @relation(fields: [studentGroupId], references: [id])

     @@index([trainingSessionId])
     @@map("pricing_rules")
   }

   model Payment {
     id              String        @id @default(cuid())
     enrollmentId    String
     amount          Float
     currency        String        @default("EUR")
     method          PaymentMethod
     reference       String?       // référence bancaire, numéro de chèque
     status          PaymentStatus
     paidAt          DateTime?
     createdAt       DateTime      @default(now())
     recordedBy      String        // userId

     enrollment      Enrollment    @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

     @@index([enrollmentId])
     @@index([status])
     @@map("payments")
   }

   enum PaymentMethod {
     CASH
     CHECK
     BANK_TRANSFER
     CARD
     OTHER
   }

   enum PaymentStatus {
     PENDING
     COMPLETED
     FAILED
     REFUNDED
   }
   ```
2. Ajouter `pricingRules` à `TrainingSession` et `payments` à `Enrollment`.

**Fichiers à modifier**
- `prisma/schema.prisma`
- `src/services/rbac.ts` (ajouter `PricingRule` et `Payment` aux ressources protégées)
- `src/lib/validations/payment.ts` (nouveau)

**Tests**
- Tests de schéma Prisma.
- Tests d'intégration : créer une règle de tarification, créer un paiement.

**Estimation** : 1,5 jour.

---

### S5-02 — Créer le service de tarification

**Solution**
1. Créer `src/services/pricing.ts` avec :
   ```ts
   export async function getPriceForEnrollment(
     db: Db,
     enrollmentId: string,
   ): Promise<{ amount: number; currency: string; taxRate: number; breakdown: PricingBreakdown }>

   export interface PricingBreakdown {
     baseAmount: number;
     taxAmount: number;
     totalAmount: number;
     appliedRule: {
       ruleId: string;
       category?: string;
       level?: string;
       group?: string;
     };
   }
   ```
2. Logique :
   - Récupérer l'inscription → session → règles de tarification.
   - Appliquer la règle la plus spécifique : groupe > catégorie > niveau > défaut.
   - Si aucune règle ne correspond, utiliser un prix par défaut sur la session (ajouter `defaultPrice` à `TrainingSession` si nécessaire).
3. Ajouter `PricingRuleServiceError` si aucune règle ne correspond.

**Fichiers à modifier / créer**
- `src/services/pricing.ts` (nouveau)
- `src/services/trainingSession.ts` (ajouter `defaultPrice`)

**Tests**
- Tests unitaires : règle par catégorie, règle par groupe, priorité des règles.
- Tests d'intégration : inscription sans règle → erreur ou prix par défaut.

**Estimation** : 1,5 jour.

---

### S5-03 — Créer le service de paiement

**Solution**
1. Créer `src/services/payments.ts` avec :
   ```ts
   export async function recordPayment(
     db: Db,
     enrollmentId: string,
     amount: number,
     method: PaymentMethod,
     actorId: string,
     options?: { reference?: string; paidAt?: Date },
   ): Promise<Payment>

   export async function refundPayment(
     db: Db,
     paymentId: string,
     actorId: string,
     reason: string,
   ): Promise<Payment>
   ```
2. `recordPayment` :
   - Vérifier que l'inscription existe et appartient à une session.
   - Créer le paiement avec statut `COMPLETED`.
   - Logger dans `AuditLog`.
3. `refundPayment` :
   - Vérifier que le paiement est `COMPLETED`.
   - Passer le statut à `REFUNDED`.
   - Logger dans `AuditLog`.

**Fichiers à modifier / créer**
- `src/services/payments.ts` (nouveau)

**Tests**
- Tests unitaires : enregistrement, remboursement.
- Tests d'intégration : remboursement d'un paiement déjà remboursé → erreur.

**Estimation** : 1 jour.

---

### S5-04 — Calculer la balance par inscription

**Solution**
1. Ajouter dans `src/services/payments.ts` :
   ```ts
   export async function getEnrollmentBalance(
     db: Db,
     enrollmentId: string,
   ): Promise<{ totalDue: number; totalPaid: number; balance: number; currency: string }>
   ```
2. Logique :
   - `totalDue` = somme des `PricingRule` applicables (ou `defaultPrice`).
   - `totalPaid` = somme des paiements `COMPLETED` (hors remboursements ou après déduction des remboursements).
   - `balance` = `totalDue - totalPaid`.
3. Exposer via `GET /api/enrollments/[id]/balance`.
4. Ajouter `balance` dans la réponse de `GET /api/enrollments`.

**Fichiers à modifier / créer**
- `src/services/payments.ts` (complété)
- `src/app/api/enrollments/[id]/balance/route.ts` (nouveau)

**Tests**
- Tests unitaires : balance équilibrée, balance négative (trop-perçu), balance positive (reste à payer).
- Tests d'intégration : après plusieurs paiements, balance correcte.

**Estimation** : 1 jour.

---

### S5-05 — Ajouter les endpoints API de paiement

**Solution**
1. `POST /api/enrollments/[id]/payments` :
   - Enregistrer un paiement.
   - Corps : `{ amount, method, reference, paidAt? }`.
2. `POST /api/payments/[id]/refund` :
   - Rembourser un paiement (MANAGER / ADMIN).
   - Corps : `{ reason }`.
3. `GET /api/enrollments/[id]/payments` :
   - Liste des paiements d'une inscription.
4. `GET /api/enrollments/[id]/balance` :
   - Balance calculée (voir S5-04).

**Fichiers à modifier / créer**
- `src/app/api/enrollments/[id]/payments/route.ts` (nouveau)
- `src/app/api/payments/[id]/refund/route.ts` (nouveau)
- `src/app/api/enrollments/[id]/balance/route.ts` (nouveau)

**Tests**
- Tests d'intégration : créer un paiement → 201, balance mise à jour.
- Tests RBAC : `USER` peut enregistrer un paiement, seul `MANAGER`/`ADMIN` peut rembourser.

**Estimation** : 1,5 jour.

---

### S5-06 — Implémenter les exports financiers

**Solution**
1. `GET /api/sessions/[id]/payments/export` :
   - Formats : CSV, Excel.
   - Colonnes : Nom participant, Email, Montant dû, Montant payé, Balance, Date dernier paiement, Méthode.
2. `GET /api/sessions/[id]/pricing/export` :
   - Exporter les règles de tarification.
3. Ajouter un endpoint `GET /api/reports/financial-summary` pour un résumé global (total dû, total payé, balance globale par session).

**Fichiers à modifier / créer**
- `src/app/api/sessions/[id]/payments/export/route.ts` (nouveau)
- `src/app/api/reports/financial-summary/route.ts` (nouveau)
- `src/services/exports.ts` (complété)

**Tests**
- Tests d'intégration : export CSV → fichier valide.
- Tests d'intégration : résumé financier → totaux cohérents.

**Estimation** : 1 jour.

---

### S5-07 — Tests E2E du workflow financier

**Objectif**
Vérifier que la tarification, les paiements, les balances et les exports fonctionnent ensemble.

**Scénarios**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `pricing-rules.spec.ts` | Créer des règles de tarification par catégorie | Prix appliqués correctement |
| `payment-flow.spec.ts` | Enregistrer un paiement partiel, puis le compléter | Balance à jour après chaque paiement |
| `payment-refund.spec.ts` | Rembourser un paiement | Balance mise à jour, audit tracé |
| `financial-export.spec.ts` | Exporter les paiements d'une session | CSV/Excel cohérents |

**Fichiers à créer / modifier**
- `e2e/pricing-rules.spec.ts` (nouveau)
- `e2e/payment-flow.spec.ts` (nouveau)
- `e2e/payment-refund.spec.ts` (nouveau)
- `e2e/financial-export.spec.ts` (nouveau)

**Estimation** : 1,5 jour.

---

## Ordre de traitement recommandé

```
Jour 1 : S5-01 (modèle PricingRule/Payment)
Jour 2 : S5-02 (service pricing)
Jour 3 : S5-03 (service payments)
Jour 4 : S5-04 (balance)
Jour 5 : S5-05 (API paiements)
Jour 6 : S5-06 (exports)
Jour 7 : S5-07 (tests E2E) — début
Jour 8-9 : S5-07 (suite) + revue + merge
```

## Risques du sprint

| Risque | Mitigation |
|---|---|
| Calcul de prix complexe (règles multiples) | Commencer par une seule règle par session, puis ajouter les priorités. |
| Devises multiples | Limiter le sprint à EUR, ajouter le support multi-devises plus tard. |
| Remboursements partiels | Préciser dans le modèle si un paiement peut être remboursé plusieurs fois. |

## Livrables

1. `prisma/schema.prisma` mis à jour + migration.
2. `src/services/pricing.ts` (nouveau service).
3. `src/services/payments.ts` (nouveau service).
4. `src/app/api/enrollments/[id]/payments/route.ts` (nouveau).
5. `src/app/api/payments/[id]/refund/route.ts` (nouveau).
6. `src/app/api/sessions/[id]/payments/export/route.ts` (nouveau).
7. UI : tableau des paiements, indicateur de balance, export.
8. Tests unitaires, d'intégration et E2E.
