# Sprint 8 — CI/CD, monitoring et sauvegarde/restauration

**Objectif** : industrialiser le déploiement, mettre en place le monitoring et définir les procédures de sauvegarde et de restauration.

**Durée estimée** : 2 semaines.

**Équipe suggérée** : 1 DevOps / 1 dev full-stack.

**Definition of Done** :
- Le déploiement est automatisé via CI/CD.
- Le monitoring et les alertes sont opérationnels en production.
- Les sauvegardes sont automatiques et la procédure de restauration est documentée et testée.
- Le runbook d'incident est rédigé.

---

## Tâches du sprint

| ID | Titre | Type | Priorité | Complexité |
|---|---|---|---|---|
| S8-01 | Automatiser le déploiement CI/CD | DevOps | P0 | M |
| S8-02 | Mettre en place le monitoring et les alertes | DevOps | P0 | M |
| S8-03 | Configurer les sauvegardes automatiques | DevOps | P0 | M |
| S8-04 | Rédiger la procédure de restauration | DevOps | P0 | S |
| S8-05 | Rédiger le runbook d'incident | DevOps | P1 | M |
| S8-06 | Tester la restauration complète | DevOps | P0 | M |
| S8-07 | Documenter l'architecture et l'exploitation | Docs | P1 | S |

---

## Détail des tâches

### S8-01 — Automatiser le déploiement CI/CD

**Solution**
1. Choisir une stratégie de déploiement :
   - **Recommandé** : déploiement continu sur `main` avec environnement de staging automatique, et déploiement manuel en production via GitHub Actions.
   - Alternative : GitLab CI ou tout autre outil selon l'infrastructure.
2. Configurer les workflows GitHub Actions :
   ```yaml
   name: CI/CD
   on:
     push:
       branches: [main, develop]
     pull_request:
       branches: [main]
   jobs:
     lint:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
         - run: npm ci
         - run: npm run lint
         - run: npm run typecheck
     test:
       runs-on: ubuntu-latest
       services:
         postgres:
           image: postgres:16
           env:
             POSTGRES_USER: test
             POSTGRES_PASSWORD: test
             POSTGRES_DB: ceil_test
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
         - run: npm ci
         - run: npm run db:reset
         - run: npm run test
     e2e:
       needs: test
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
         - run: npm ci
         - run: npm run db:reset
         - run: npm run test:e2e
     deploy-staging:
       if: github.ref == 'refs/heads/develop'
       needs: [lint, test, e2e]
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - run: npm run deploy:staging
     deploy-production:
       if: github.ref == 'refs/heads/main'
       needs: [lint, test, e2e]
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - run: npm run deploy:production
   ```
3. Ajouter des secrets GitHub pour les déploiements (`SSH_KEY`, `DATABASE_URL`, etc.).
4. Mettre en place des environments de preview pour les PRs (optionnel, via Vercel/Render/Fly.io).

**Fichiers à modifier / créer**
- `.github/workflows/ci.yml` (nouveau)
- `.github/workflows/deploy.yml` (nouveau)
- `package.json` (scripts de déploiement)
- `vercel.json` / `render.yaml` / `Dockerfile` selon l'hébergeur

**Tests**
- Ouvrir une PR → vérifier que lint, tests et e2e s'exécutent.
- Merger sur `develop` → vérifier le déploiement staging.
- Merger sur `main` → vérifier le déploiement production.

**Estimation** : 2 jours.

---

### S8-02 — Mettre en place le monitoring et les alertes

**Solution**
1. Choisir les outils selon l'infrastructure :
   - **Hébergement managé** (Vercel, Render) : utiliser leurs dashboards natifs.
   - **Auto-hébergement** : Prometheus + Grafana, ou Datadog, ou UptimeRobot.
2. Métriques à surveiller :
   - Disponibilité (`/api/health` endpoint).
   - Latence P95/P99 des endpoints API.
   - Taux d'erreur 4xx/5xx.
   - Connexions base de données actives.
   - Taille de la queue (si applicable).
3. Alertes :
   - Erreur 5xx > 1% sur 5 minutes → alerte Slack/email.
   - Base de données indisponible → alerte immédiate.
   - Espace disque < 20% → alerte.
4. Ajouter un endpoint `/api/health` pour les health checks :
   ```ts
   export const GET = async () => {
     const dbHealthy = await checkDatabase();
     return NextResponse.json({ status: dbHealthy ? 'ok' : 'error', timestamp: new Date().toISOString() });
   };
   ```

**Fichiers à modifier / créer**
- `src/app/api/health/route.ts` (nouveau)
- Configuration monitoring (Prometheus, Grafana, etc.)
- Alertes (Slack, email, PagerDuty)

**Tests**
- Vérifier que `/api/health` retourne `200` ou `503` selon l'état.
- Simuler une panne → vérifier que l'alerte est déclenchée.

**Estimation** : 1,5 jour.

---

### S8-03 — Configurer les sauvegardes automatiques

**Solution**
1. Stratégie de sauvegarde :
   - **Base de données** : sauvegarde quotidienne à 2h du matin (heure de faible trafic).
   - **Fichiers uploadés** : sauvegarde quotidienne synchronisée avec le stockage objet.
   - **Rétention** : 30 jours pour les sauvegardes quotidiennes, 12 semaines pour les hebdomadaires.
2. Implémentation selon l'infrastructure :
   - **PostgreSQL managé** (Supabase, Neon, RDS) : activer les sauvegardes automatiques du fournisseur.
   - **PostgreSQL auto-hébergé** : `pg_dump` + cron ou `pgBackRest`.
   - **Fichiers** : `rclone` ou sync vers stockage objet (S3, MinIO).
3. Vérifier la sauvegarde :
   - Restaurer une sauvegarde sur une base de test chaque semaine.
   - Vérifier l'intégrité des données (checksum).

**Fichiers à modifier / créer**
- `scripts/backup.sh` (nouveau)
- `scripts/restore.sh` (nouveau)
- `docs/backup-restore.md` (nouveau)
- Configuration cron / scheduler

**Tests**
- Exécuter le script de sauvegarde manuellement → fichier valide.
- Restaurer sur une base de test → données cohérentes.

**Estimation** : 1 jour.

---

### S8-04 — Rédiger la procédure de restauration

**Solution**
1. Documenter la procédure étape par étape dans `docs/backup-restore.md` :
   - Étape 1 : Arrêter l'application.
   - Étape 2 : Créer une base de données de restauration.
   - Étape 3 : Restaurer le dump SQL (`psql -f backup.sql`).
   - Étape 4 : Vérifier l'intégrité des données.
   - Étape 5 : Redémarrer l'application.
   - Étape 6 : Valider la restauration (health check, tests fonctionnels).
2. Ajouter un script automatisé `scripts/restore.sh` qui accepte un fichier de sauvegarde en paramètre.
3. Prévoir un mécanisme de rollback du code (tag Git) en cas de régression après restauration.

**Fichiers à modifier / créer**
- `docs/backup-restore.md` (nouveau)
- `scripts/restore.sh` (nouveau)

**Tests**
- Exécuter la procédure de restauration complète sur un environnement de test.
- Mesurer le temps de restauration (objectif : < 30 min pour 10 Go).

**Estimation** : 1 jour.

---

### S8-05 — Rédiger le runbook d'incident

**Solution**
1. Créer `docs/runbook.md` avec les scénarios d'incident courants :
   - **Base de données indisponible** : vérifier les connexions, redémarrer le service, restaurer la sauvegarde.
   - **Espace disque plein** : identifier les fichiers logs/upload, nettoyer, agrandir le volume.
   - **Erreur 5xx massive** : vérifier les logs, identifier la cause (migration, dépendance externe), rollback.
   - **Sauvegarde échouée** : vérifier l'espace disque, les permissions, relancer manuellement.
   - **Déploiement en échec** : annuler le déploiement, vérifier les migrations, corriger et redéployer.
2. Inclure pour chaque scénario :
   - Symptômes.
   - Diagnostic (commandes, logs, dashboards).
   - Actions de remédiation (court terme).
   - Actions de correction (long terme).
   - Contacts d'astreinte.

**Fichiers à modifier / créer**
- `docs/runbook.md` (nouveau)

**Tests**
- Revue par l'équipe ops.
- Exercice de table pour valider la procédure.

**Estimation** : 1 jour.

---

### S8-06 — Tester la restauration complète

**Solution**
1. Planifier un exercice de restauration trimestriel :
   - Sauvegarder la base de production.
   - Restaurer sur un environnement isolé (staging ou VM dédiée).
   - Vérifier l'intégrité des données (comptes, inscriptions, paiements).
   - Exécuter un sous-ensemble de tests E2E pour valider le bon fonctionnement.
2. Mesurer et documenter le RTO (Recovery Time Objective) et le RPO (Recovery Point Objective).
3. Corriger les problèmes découverts (données manquantes, permissions, etc.).

**Fichiers à modifier / créer**
- `docs/backup-restore.md` (mis à jour avec les résultats du test)
- `scripts/test-restore.sh` (nouveau)

**Tests**
- Restauration complète réussie.
- RTO et RPO conformes aux exigences métier.

**Estimation** : 1 jour.

---

### S8-07 — Documenter l'architecture et l'exploitation

**Solution**
1. Mettre à jour `docs/` avec :
   - **Architecture** : diagramme des composants, flux de données, dépendances externes.
   - **Déploiement** : environnement, variables d'environnement, procédure de déploiement.
   - **Sécurité** : politiques de sécurité, gestion des secrets, rotation des clés.
   - **Maintenance** : procédures de maintenance préventive (mise à jour des dépendances, purge des logs).
2. Ajouter un `README.md` à la racine avec les instructions d'installation, de configuration et de contribution.

**Fichiers à modifier / créer**
- `docs/architecture.md` (nouveau ou mis à jour)
- `docs/deployment.md` (nouveau ou mis à jour)
- `docs/maintenance.md` (nouveau ou mis à jour)
- `README.md` (mis à jour)

**Tests**
- Revue par l'équipe.
- Vérification que la documentation est à jour par rapport au code.

**Estimation** : 0,5 jour.

---

## Ordre de traitement recommandé

```
Semaine 1 :
  Jour 1-2 : S8-01 (CI/CD)
  Jour 3-4 : S8-02 (monitoring)
  Jour 5 : S8-03 (sauvegardes)
  Jour 6 : S8-04 (restauration) + S8-05 (runbook)

Semaine 2 :
  Jour 7 : S8-06 (test de restauration)
  Jour 8 : S8-07 (documentation)
  Jour 9-10 : revue + corrections + validation finale
```

## Risques du sprint

| Risque | Mitigation |
|---|---|
| Sauvegarde non testée | Planifier l'exercice de restauration avant la fin du sprint. |
| CI trop lente | Mettre en cache `node_modules`, exécuter les tests en parallèle. |
| Alertes ignorées | Configurer des canaux d'alerte fiables (Slack, email) et définir des seuils réalistes. |
| Procédure de restauration obsolète | Documenter la procédure et la tester régulièrement (trimestriel). |

## Livrables

1. Workflows GitHub Actions pour CI/CD.
2. Endpoint `/api/health` et configuration monitoring.
3. Scripts de sauvegarde et de restauration.
4. `docs/backup-restore.md` avec procédure détaillée.
5. `docs/runbook.md` avec scénarios d'incident.
6. Documentation d'architecture et d'exploitation.
7. Rapport de test de restauration (RTO/RPO).
