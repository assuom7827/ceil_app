# Security Review — CEIL

## Méthodologie

Revue statique du code (services, API, auth, validation, documents) et des retours des sous-agents. Aucun test d'intrusion n'a été réalisé.

## 1. Forces

* **RBAC systématique côté serveur** : chaque route API passe par `src/lib/api/handler.ts` qui vérifie le rôle.
* **Erreurs d'authentification uniformes** : un attaquant ne peut pas distinguer email inconnu, mot de passe invalide et compte désactivé.
* **Pas de fuite de `passwordHash`** : les réponses API excluent le hash.
* **Valeurs dérivées centralisées** : réduit les risques de manipulation côté client.
* **Verrouillage workflow** : `assertSessionWritable` / `assertPositioningTestWritable` bloquent les écritures sur objets verrouillés.

## 2. Risques identifiés

### 2.1 Authentification

| ID | Risque | Sévérité | Fichier | Description | Recommandation |
|---|---|---|---|---|---|
| SEC-001 | Pas de rate limiting login | **Haute** | `src/auth.ts` | Un attaquant peut brute-forcer les mots de passe sans limite applicative. | Ajouter rate limiting côté reverse proxy ou middleware compatible edge ; ou intégrer un mécanisme de fail2ban. |
| SEC-002 | Révocation de session limitée | Moyenne | `src/auth.ts` | Stratégie JWT : un compte désactivé reste actif jusqu'à expiration du token. | Réduire le TTL du token et vérifier `active` côté serveur régulièrement. |
| SEC-003 | Mot de passe sans complexité | Moyenne | `src/lib/validation/schemas.ts` | `userSchema` impose 10 caractères mais pas de complexité (majuscule, chiffre, etc.). | Ajouter une règle de complexité. |
| SEC-004 | Bootstrap ADMIN restreint à l'infrastructure | Moyenne | README / API | `POST /api/users` est protégé par rôle mais pas par IP ; le README documente la restriction réseau. | Vérifier la configuration reverse proxy et pare-feu ; ajouter un check `localhost` en développement. |

### 2.2 Autorisation / RBAC

| ID | Risque | Sévérité | Fichier | Description | Recommandation |
|---|---|---|---|---|---|
| SEC-005 | Rôle `USER` trop permissif | **Haute** | `src/services/rbac.ts` | `USER` peut supprimer/modifier participant, groupe, session, notes, etc. | Restreindre `USER` à lecture + actions de saisie ciblées. |
| SEC-006 | `USER` peut écrire un AuditLog | **Haute** | `src/services/rbac.ts` | `canWrite` retourne `true` pour `AuditLog` car absent de `USER_READ_ONLY_RESOURCES`. | Interdire l'écriture d'`AuditLog` à `USER`. |
| SEC-007 | Pas de vérification de portée (ownership) | Moyenne | CRUD générique | Un `USER` autorisé en écriture peut théoriquement modifier n'importe quel enregistrement par ID. | Ajouter des vérifications d'appartenance si le modèle métier l'exige. |
| SEC-008 | Dernière protection admin partielle | Moyenne | `src/app/api/users/[id]/route.ts` | Empêche auto-suppression/auto-désactivation mais ne vérifie pas qu'il reste au moins un ADMIN actif. | Ajouter cette vérification globale. |

### 2.3 Injection et validation

| ID | Risque | Sévérité | Fichier | Description | Recommandation |
|---|---|---|---|---|---|
| SEC-009 | `scoreSchema` très permissif (max 1000) | Moyenne | `src/lib/validation/schemas.ts` | Un utilisateur peut saisir des notes jusqu'à 1000 sans lien avec le barème. | Lier le maximum au barème de la session/niveau. |
| SEC-010 | Paramètres `entityType` non validés dans `/api/audit-logs` | Moyenne | `src/app/api/audit-logs/route.ts` | Filtre potentiellement injectable dans Prisma. | Valider `entityType` contre une liste blanche. |
| SEC-011 | `dangerouslySetInnerHTML` dans les documents | Moyenne | `src/components/documents/sheets.tsx` | Contenu HTML administrateur ; si compromis, risque XSS. | Sanitiser le HTML ou restreindre l'éditeur à un sous-ensemble de balises. |

### 2.4 IDOR et accès aux documents

| ID | Risque | Sévérité | Fichier | Description | Recommandation |
|---|---|---|---|---|---|
| SEC-012 | IDOR documents officiels | **Haute** | `src/app/api/sessions/[id]/attestation/route.ts`, `/certificates/route.ts` | Query `enrollmentId` n'est pas vérifié comme appartenant à la session `[id]`. | Vérifier `enrollment.trainingSessionId === params.id`. |
| SEC-013 | Vérification publique exposée | Moyenne | `src/app/verify/[id]/[enrollmentId]/page.tsx` | Endpoint public expose des PII si les IDs sont prévisibles. | Utiliser un token opaque ou hasher l'identifiant. |

### 2.5 Upload et fichiers

| ID | Risque | Sévérité | Fichier | Description | Recommandation |
|---|---|---|---|---|---|
| SEC-014 | Pas de limite de taille générale | Moyenne | `src/lib/api/handler.ts` `readUpload` | Pas de `maxSize` dans le wrapper d'upload. | Ajouter une limite par route. |
| SEC-015 | Logos écrasés sans renommage aléatoire | Faible | `src/app/api/diploma-models/[id]/logos/route.ts` | Noms prévisibles mais contrôlés. | Renommage aléatoire + contrôle MIME/extension. |

### 2.6 Audit et traçabilité

| ID | Risque | Sévérité | Fichier | Description | Recommandation |
|---|---|---|---|---|---|
| SEC-016 | Audit non transactionnel | **Haute** | `src/services/enrollment.ts`, `locking.ts`, `groups.ts` | `logAudit` appelé hors transaction ou avant l'opération. | Inclure l'audit dans `withTransaction`. |
| SEC-017 | Aucune IP dans les logs | Moyenne | `src/services/audit.ts` | Champ `ipAddress` jamais renseigné. | Récupérer l'IP depuis la requête. |
| SEC-018 | Données sensibles dans l'audit | Moyenne | `src/services/audit.ts` | `oldValue`/`newValue` peuvent contenir des PII sans limitation. | Définir une liste de champs à exclure (passwordHash, etc.). |

### 2.7 Suppression et intégrité

| ID | Risque | Sévérité | Fichier | Description | Recommandation |
|---|---|---|---|---|---|
| SEC-019 | Pas de soft-delete | **Haute** | Modèle global | Suppression dure avec CASCADE sur entités critiques. | Implémenter soft-delete + `deletedBy`/`deletedAt`. |
| SEC-020 | Suppression sans vérification d'usage | Moyenne | CRUD générique | Suppression de participant/session/groupe sans vérifier les dépendances. | Vérifier ou passer en soft-delete. |

## 3. Matrice de risques

| Risque | Probabilité | Impact | Priorité |
|---|---|---|---|
| Rôle USER excessif | Élevée | Élevée | P0 |
| IDOR documents | Élevée (facilement testable) | Élevée | P0 |
| Pas de rate limiting login | Élevée | Élevée | P0 |
| Audit non transactionnel | Moyenne | Élevée | P0 |
| Pas de soft-delete | Moyenne | Élevée | P1 |
| Vérification publique PII | Moyenne | Moyenne | P1 |
| Révocation JWT limitée | Moyenne | Moyenne | P1 |
| Validation notes trop permissive | Moyenne | Moyenne | P2 |
| Upload sans limite de taille | Faible | Moyenne | P2 |

## 4. Recommandations prioritaires

1. **Restreindre le rôle USER** : limiter à lecture + saisie de notes/présences/paiements ; interdire suppression et écriture d'audit.
2. **Corriger l'IDOR sur les documents** : joindre `enrollment` et vérifier `trainingSessionId`.
3. **Ajouter le rate limiting** : au minimum au niveau reverse proxy, idéalement via middleware.
4. **Audit transactionnel** : déplacer tous les `logAudit` dans la transaction métier.
5. **Soft-delete généralisé** : protéger les entités critiques avant la production.
6. **Sécuriser la vérification publique** : token opaque, exposer le minimum d'informations.
7. **Renforcer la complexité des mots de passe**.
8. **Valider `entityType` dans `/api/audit-logs`**.
9. **Sanitiser ou restreindre le HTML injecté dans les documents**.
10. **Audit des champs sensibles** : empêcher le log de `passwordHash` et autres secrets.
