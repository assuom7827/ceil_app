# Reprendre ce projet

Ce fichier est le **point d'entrée** de toute nouvelle session — humaine ou IA.
Il ne décrit pas le produit (c'est le rôle du `README`) : il dit où trouver quoi,
ce qui ne se discute pas, et ce qui a déjà coûté cher.

## Où est quoi

| Fichier                                              | Contenu                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| [`README.md`](./README.md)                           | Le produit : démarrage, API, écrans, documents officiels      |
| [`docs/architecture.md`](./docs/architecture.md)     | L'organisation du code et les contrats internes               |
| [`docs/decisions.md`](./docs/decisions.md)           | **Pourquoi** le code est ainsi — journal daté, jamais réécrit |
| [`docs/etat-du-projet.md`](./docs/etat-du-projet.md) | Ce qui reste à faire, questions ouvertes, limites connues     |
| [`docs/exploitation.md`](./docs/exploitation.md)     | Déploiement, reprise de données existantes, sauvegardes       |
| [`docs/import-excel.md`](./docs/import-excel.md)     | Format des imports — document destiné aux **utilisateurs**    |
| [`CHANGELOG.md`](./CHANGELOG.md)                     | Historique chronologique des livraisons                       |
| [`src/services/README.md`](./src/services/README.md) | Rôle de chaque service métier                                 |

Une information vit à **un seul endroit**. Si elle manque, c'est qu'elle doit y
être ajoutée — pas recopiée ailleurs.

## Avant de modifier quoi que ce soit

1. Lire `docs/etat-du-projet.md` : il dit où en est le travail et ce qui bloque.
2. Lire `docs/decisions.md` pour le domaine concerné. Beaucoup de choix
   surprenants y sont argumentés ; les défaire sans lire, c'est les refaire.
3. Ne rien supposer que le dépôt sait déjà : le schéma Prisma, les schémas Zod et
   les tests sont la référence, pas la mémoire d'une session précédente.

## Règles qui ne se discutent pas

1. **Aucune valeur dérivée n'est stockée.** `fullName`, `title`, totaux, statut
   d'admission, années, mois arabe, et toute formation/niveau déductible d'une
   relation parente sont calculés à la lecture par `src/services/derive.ts`.
   Ce fichier est **pur** — pas d'import Prisma, pas de DOM — parce que l'API
   **et** le navigateur l'importent tous les deux. Le garder pur n'est pas une
   coquetterie : c'est ce qui interdit qu'un écran affiche autre chose que la base.
2. **La règle métier vit dans `src/services/`**, jamais dans un Route Handler ni
   dans un composant.
3. **Le RBAC est vérifié côté serveur**, sur chaque route, avant d'atteindre la
   donnée. Masquer un bouton n'est pas une protection.
4. **Une seule forme d'erreur** : `{ error, message, details? }`, produite par le
   wrapper `src/lib/api/handler.ts`. Ne jamais renvoyer une erreur Prisma brute.
5. **Les schémas Zod de `src/lib/validation/schemas.ts` sont partagés** client et
   serveur. Une règle de saisie ne se réécrit pas côté client.
6. **Toute règle est couverte par un test.** Ce qui dépend du moteur (atomicité
   des compteurs, contraintes d'unicité, `onDelete`) est testé sur une **vraie**
   base PostgreSQL, pas sur un mock.
7. **La documentation fait partie du changement.** Une évolution qui touche le
   modèle, une API, une convention ou une limite connue met à jour la mémoire
   dans le **même commit**.

## Avant de considérer une tâche terminée

```bash
npm run typecheck && npm run lint && npm test
```

Puis : documentation synchronisée, entrée ajoutée au `CHANGELOG.md`, décision
consignée dans `docs/decisions.md` si un choix structurant a été fait.

Les tests e2e (`npm run test:e2e`) sont plus lents ; les lancer dès qu'un écran,
un formulaire ou une grille change.

## Conventions

- **Langue** : code et commentaires en français, comme le domaine métier.
  Les commentaires expliquent **pourquoi**, jamais **quoi**.
- **Commits** : titre en français, corps expliquant la raison du changement et
  les alternatives écartées. Un commit par intention.
- **Branche de développement** : `claude/ceil-management-webapp-fm506g`.
- **Format** : Prettier (`npm run format`), ESLint sans avertissement toléré.

## Pièges déjà payés

Chacun a coûté une investigation. Le détail est dans `docs/decisions.md`.

| Piège                                                                     | À retenir                                                                         |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `prisma migrate dev` est interactif et échoue en environnement automatisé | Utiliser `migrate diff` + dossier de migration écrit à la main, puis `deploy`     |
| Tests d'intégration en parallèle                                          | Ils partagent une base et la remettent à zéro : `fileParallelism: false`          |
| Matricules forgés à la main dans un fixture ou un import direct           | Le compteur `sequence_counters` se désynchronise → collision (voir exploitation)  |
| `AUTH_URL` sur `localhost`, tests sur `127.0.0.1`                         | Le cookie de session est posé sur un hôte et relu sur l'autre : connexion muette  |
| Playwright `fill()`                                                       | Ne reproduit pas la frappe réelle ; utiliser `pressSequentially` pour les grilles |
| Colonnes TanStack reconstruites à chaque rendu                            | Les `<input>` sont remontés et perdent des caractères : mémoriser par structure   |
| Augmentation de type NextAuth                                             | Cibler `@auth/core/jwt`, pas `next-auth/jwt` qui ne fait que réexporter           |

## Base de données en développement

`docker compose up -d` fournit PostgreSQL 16 et Adminer. Sans Docker (conteneur
d'agent, CI restreinte), une instance locale suffit :

```bash
pg_ctl -D <datadir> -o "-p 5432 -k /tmp" start
```

Les suites d'intégration attendent une base `ceil_test` ; sans base joignable,
elles sont **ignorées** plutôt que rouges — vérifier qu'elles ont bien tourné
avant d'annoncer un test vert.
