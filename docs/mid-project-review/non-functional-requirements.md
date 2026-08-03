# Exigences non fonctionnelles — CEIL

## Légende des identifiants

* `NFR-PERF-*` : Performance
* `NFR-SEC-*` : Sécurité
* `NFR-AVA-*` : Disponibilité
* `NFR-SCA-*` : Scalabilité
* `NFR-MAIN-*` : Maintenabilité
* `NFR-ACC-*` : Accessibilité
* `NFR-I18N-*` : Internationalisation
* `NFR-AUD-*` : Auditabilité

## 1. Performance

### NFR-PERF-001 — Temps de réponse API

95 % des requêtes API doivent répondre en moins de **500 ms** en conditions normales de charge.

### NFR-PERF-002 — Temps de réponse pages critiques

Les pages du tableau de bord et du workspace doivent afficher leur premier contenu utile (FCP) en moins de **1,5 s** sur une connexion standard.

### NFR-PERF-003 — N+1 queries

Les requêtes de liste et de dashboard doivent éviter les requêtes N+1 ; utiliser les `include` Prisma appropriés ou des agrégations SQL.

### NFR-PERF-004 — Pagination

Toutes les listes API sont paginées avec un maximum de **200 éléments par page** (déjà en place).

### NFR-PERF-005 — Caching

Les requêtes de référentiels (facultés, catégories, niveaux) peuvent être mises en cache côté client et rafraîchies au changement.

### NFR-PERF-006 — Bundle frontend

Éviter l'import inconditionnel de bibliothèques lourdes (`xlsx`, `qrcode`) dans le bundle initial ; utiliser le *lazy loading* si nécessaire.

### NFR-PERF-007 — Génération PDF

La génération d'attestations PDF par LibreOffice ne doit pas bloquer le thread principal ; utiliser un processus isolé avec timeout (< 30 s par lot).

### NFR-PERF-008 — Dashboard

Le dashboard ne doit pas recalculer l'ensemble des admissions à chaque chargement si les données n'ont pas changé ; prévoir un cache court (ex. 60 s) ou un matérialisé.

## 2. Sécurité

### NFR-SEC-001 — Authentification

Seuls les utilisateurs actifs avec un mot de passe valide peuvent se connecter. Message d'échec identique quel que soit le motif.

### NFR-SEC-002 — Rate limiting login

Limiter les tentatives de connexion : maximum **5 échecs par adresse IP et par compte en 15 minutes**, avec verrouillage temporaire ou CAPTCHA.

### NFR-SEC-003 — RBAC serveur

Chaque route API valide le rôle de l'utilisateur avant d'accéder aux données. Masquer un lien n'est pas une protection.

### NFR-SEC-004 — Portée des permissions

Le rôle `USER` ne doit pas pouvoir supprimer ou modifier des ressources critiques ; il doit être limité à la saisie métier.

### NFR-SEC-005 — Validation des entrées

Toutes les entrées utilisateur (JSON, fichiers, paramètres URL) sont validées par Zod côté serveur.

### NFR-SEC-006 — Protection IDOR

Tout paramètre d'ID (participant, session, enrollment, reçu) est validé comme appartenant au périmètre autorisé de l'acteur.

### NFR-SEC-007 — Mots de passe

Les mots de passe sont hachés avec bcrypt (coût ≥ 10). Complexité minimale : 10 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial.

### NFR-SEC-008 — Gestion des sessions

Session JWT avec expiration explicite (maxAge ≤ 8h, updateAge ≤ 1h). Un compte désactivé devient inefficace dès la prochaine validation côté serveur.

### NFR-SEC-009 — Secrets

`AUTH_SECRET`, `DATABASE_URL` et autres secrets ne sont jamais commités. Rotation régulière des clés.

### NFR-SEC-010 — Upload de fichiers

Limitation de taille (ex. 5 Mo), vérification du type MIME, extension, contenu minimal (archive ODT valide), répertoire non exécutable.

### NFR-SEC-011 — Documents sensibles

Les documents officiels ne sont accessibles qu'à un utilisateur authentifié (sauf la vérification publique qui doit être minimale).

### NFR-SEC-012 — Audit logs

Les actions d'écriture critiques sont tracées avec acteur, action, entité, ancienne/nouvelle valeur, horodatage.

## 3. Disponibilité

### NFR-AVA-001 — Sauvegardes

Sauvegarde quotidienne automatisée de la base PostgreSQL (`pg_dump`) avec rétention de 30 jours.

### NFR-AVA-002 — Restauration

Procédure de restauration documentée et testée au moins une fois par trimestre. RTO < 4h, RPO < 24h.

### NFR-AVA-003 — Health checks

Endpoints `/api/health` (liveness), `/api/health?probe=readiness` (DB) et `/api/health?probe=full` (DB + LibreOffice) en place.

### NFR-AVA-004 — Monitoring

Alertes en cas d'indisponibilité DB, d'échec de génération PDF répété, ou de taux d'erreur API > 5 %.

### NFR-AVA-005 — Gestion des erreurs

Les erreurs serveur ne fuitent pas de détails internes au client. Les erreurs sont journalisées avec contexte.

### NFR-AVA-006 — Disaster recovery

Documentation d'une procédure de reprise sur incident incluant backup, restauration, et changement de DNS/scaling.

## 4. Scalabilité

### NFR-SCA-001 — Apprenants

L'application doit supporter **plusieurs milliers de participants** et **plusieurs centaines d'inscriptions par session** sans dégradation sensible.

### NFR-SCA-002 — Sessions simultanées

Possibilité d'ouvrir et gérer plusieurs sessions de formation en parallèle.

### NFR-SCA-003 — Administrateurs
**
Support de plusieurs administrateurs connectés simultanément avec isolation des transactions critiques (matricules, reçus).

### NFR-SCA-004 — Génération massive de documents

La génération de lots de diplômes/attestations doit être soit asynchrone avec notification, soit paginée pour éviter les timeouts.

### NFR-SCA-005 — Import massif

L'import de plusieurs centaines de lignes doit se faire en transaction avec retour de rapport complet et sans blocage prolongé de l'interface.

## 5. Maintenabilité

### NFR-MAIN-001 — Architecture en couches

Les services ne dépendent pas des composants UI ni des route handlers. Les dérivés (`derive.ts`) restent purs.

### NFR-MAIN-002 — Typage strict

TypeScript strict activé. Le typage du CRUD (`CrudDelegate`) ne doit pas reposer sur `unknown` systématique.

### NFR-MAIN-003 — Duplication

Les règles métier ne sont pas dupliquées entre client et serveur. `derive.ts` et les schémas Zod sont la source unique.

### NFR-MAIN-004 — Conventions

Code et commentaires en français, commits en français, documentation synchronisée à chaque changement structurant.

### NFR-MAIN-005 — Documentation

README, architecture, decisions, exploitation, import et modèle d'attestation maintenus à jour. API et règles métier documentées.

## 6. Accessibilité

### NFR-ACC-001 — Navigation clavier

Toutes les actions principales sont utilisables au clavier (formulaires, grilles, menu, onglets).

### NFR-ACC-002 — Contraste

Contraste minimum 4.5:1 pour le texte normal, 3:1 pour les composants interactifs.

### NFR-ACC-003 — Labels

Tous les champs de formulaire ont un label explicite (`htmlFor`) ou un `aria-label` pertinent.

### NFR-ACC-004 — Messages d'erreur
**
Les erreurs de validation sont associées à leur champ via `aria-describedby` et annoncées par les lecteurs d'écran.

### NFR-ACC-005 — ARIA
*
Les composants complexes (modales, onglets, menus déroulants, grilles) utilisent les rôles et attributs ARIA appropriés.

### NFR-ACC-006 — Responsive
**
L'application est utilisable sur écran de bureau et tablette. Les tableaux larges doivent défiler horizontalement sans perte de contexte.

## 7. Internationalisation

### NFR-I18N-001 — Langues supportées

L'application supporte le français et l'arabe.

### NFR-I18N-002 — RTL

Le passage en arabe applique la direction RTL (`dir="rtl"`) et la police Amiri, sur tous les écrans et les documents imprimables.

### NFR-I18N-003 — Traduction complète

Tous les libellés, messages, placeholders, erreurs et documents officiels (hors texte réglementaire fixe) sont externalisés dans `messages/fr.json` et `messages/ar.json`.

### NFR-I18N-004 — Dates et nombres

Les formats de date, heure et monnaie suivent la locale (ex. `DD/MM/YYYY` en français, calendrier hijri optionnel en arabe si besoin).

### NFR-I18N-005 — Documents bilingues

Les documents officiels juxtaposent les blocs français et arabe sans chevauchement ni troncature, quelle que soit la locale d'affichage.

## 8. Auditabilité

### NFR-AUD-001 — Actions tracées

Toute action d'écriture sur les entités métier critiques fait l'objet d'un `AuditLog` structuré.

### NFR-AUD-002 — Contenu de l'audit
**
Chaque entrée d'audit contient : identifiant de l'acteur, type d'action normalisé (`CREATE`, `UPDATE`, `DELETE`, `LOCK`, `PRINT`, etc.), type et ID de l'entité, ancienne et nouvelle valeur (diff réduit), adresse IP, timestamp.

### NFR-AUD-003 — Transactions

L'audit doit être écrit dans la même transaction que l'opération métier.

### NFR-AUD-004 — Rétention

Politique de rétention/purge des logs audit : conservation minimale 1 an, archivage possible hors base.

### NFR-AUD-005 — Historique métier

Les changements de statut d'inscription, de groupe, de niveau et de paiement sont conservés dans un historique métier dédié en plus de l'audit technique.

---

## Récapitulatif des objectifs mesurables clés

| ID | Objectif | Comment le vérifier |
|---|---|---|
| NFR-PERF-001 | 95 % API < 500 ms | K6 / Playwright + logs |
| NFR-PERF-007 | PDF < 30 s | Tests e2e + timeout |
| NFR-SEC-002 | Rate limiting login | Tests + configuration reverse proxy |
| NFR-SEC-006 | Aucun IDOR document | Tests d'API RBAC |
| NFR-AVA-001 | Backup quotidien | Script `ceil-backup.timer` |
| NFR-AVA-002 | RTO < 4h, RPO < 24h | Test de restauration |
| NFR-ACC-001 | Navigation clavier complète | Test manuel / axe-core |
| NFR-I18N-003 | 100 % libellés externalisés | Audit de chaînes en dur |
| NFR-AUD-003 | Audit transactionnel | Vérifier service par service |
