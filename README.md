# CEIL — application de gestion

Gestion du **Centre d'Enseignement Intensif des Langues** — Université Abdelhamid
Ibn Badis, Mostaganem.

L'application couvre le cycle complet : inscription des participants → test de
positionnement (niveau CECRL) → organisation en groupes → session de formation →
délibération (4 compétences, admission) → documents officiels (diplômes,
attestations, PV). Interface **bilingue français / arabe** avec RTL.

> **État actuel : étapes 1 à 3 terminées.** Structure et outillage en place ;
> modèle de données normalisé, fonctions dérivées, seed et couche services
> métier (114 tests verts). L'API REST arrive à l'étape 4.

---

## Prérequis

- Node.js ≥ 20.11 (testé sur Node 22)
- Docker et Docker Compose (pour PostgreSQL)

## Démarrage

```bash
# 1. Dépendances
npm install

# 2. Environnement
cp .env.example .env
# puis générer un secret : openssl rand -base64 32  → AUTH_SECRET

# 3. Base de données PostgreSQL (port 5432) + Adminer (port 8080)
docker compose up -d

# 4. Schéma + client Prisma
npm run db:migrate

# 5. Données de démonstration
npm run db:seed

# 6. Serveur de développement
npm run dev
```

L'application est disponible sur <http://localhost:3000>, Adminer sur
<http://localhost:8080> (serveur `db`, utilisateur `ceil`, mot de passe `ceil`).

## Comptes de démonstration

| Rôle      | Email                | Mot de passe        |
| --------- | -------------------- | ------------------- |
| `MANAGER` | `manager@ceil.local` | `Ceil@Manager2025!` |
| `USER`    | `user@ceil.local`    | `Ceil@User2025!`    |

Ces valeurs sont surchargeables via `SEED_MANAGER_*` / `SEED_USER_*` dans `.env`.

**Droits** : `MANAGER` et `ADMIN` ont le CRUD complet. `USER` gère le métier
courant mais reste en **lecture seule** sur `Training`, `TrainingLevel` et
`PaymentReceipt`. Les vérifications sont systématiquement faites côté serveur.

## Scripts

| Commande                      | Effet                                    |
| ----------------------------- | ---------------------------------------- |
| `npm run dev`                 | Serveur de développement                 |
| `npm run build` / `npm start` | Build de production / démarrage          |
| `npm run typecheck`           | TypeScript strict, sans émission         |
| `npm run lint`                | ESLint (config Next + Prettier)          |
| `npm run format`              | Prettier (avec tri des classes Tailwind) |
| `npm test`                    | Tests Vitest (unitaires + intégration)   |
| `npm run test:e2e`            | Tests end-to-end Playwright              |
| `npm run db:migrate`          | Migration de développement               |
| `npm run db:deploy`           | Migrations en production                 |
| `npm run db:seed`             | Données de démonstration                 |
| `npm run db:studio`           | Prisma Studio                            |
| `npm run db:reset`            | Réinitialisation complète de la base     |

## Stack

| Domaine           | Choix                                                           |
| ----------------- | --------------------------------------------------------------- |
| Framework         | Next.js 15 (App Router, RSC), TypeScript strict                 |
| Base de données   | PostgreSQL 16 + Prisma 6                                        |
| Authentification  | NextAuth (Auth.js v5), credentials + JWT, RBAC serveur          |
| UI                | Tailwind CSS 3 + shadcn/ui (Radix), lucide-react                |
| Grilles éditables | TanStack Table (édition inline, collage Excel)                  |
| Import / export   | `xlsx` et `papaparse`                                           |
| i18n              | next-intl — `fr` par défaut, `ar` en RTL (cookie `NEXT_LOCALE`) |
| Validation        | Zod, schémas partagés client / serveur                          |
| Tests             | Vitest (unitaires), Playwright (e2e)                            |

## Structure du projet

```
ceil_app/
├── docker-compose.yml         # PostgreSQL 16 + Adminer
├── components.json            # configuration shadcn/ui
├── prisma/
│   ├── schema.prisma          # schéma (étape 2 : modèle normalisé complet)
│   └── seed.ts                # seed reproductible
├── src/
│   ├── app/                   # App Router
│   │   ├── layout.tsx         # lang/dir pilotés par la locale
│   │   ├── page.tsx           # accueil provisoire
│   │   ├── globals.css        # thème + styles d'impression A4
│   │   └── api/
│   │       ├── health/        # sonde de disponibilité
│   │       └── auth/[...nextauth]/
│   ├── auth.ts                # configuration NextAuth (credentials)
│   ├── components/ui/         # primitives shadcn/ui
│   ├── i18n/                  # config + chargement des messages
│   ├── lib/                   # prisma, env validé, utilitaires
│   ├── messages/              # fr.json, ar.json
│   └── services/              # couche métier (voir services/README.md)
├── tests/                     # Vitest
└── e2e/                       # Playwright
```

## Principes d'architecture

1. **La session de formation est le pivot.** L'essentiel de la saisie se fera
   depuis `/sessions/[id]/workspace` : grilles éditables, imports Excel/CSV,
   calculs en direct — sans naviguer de formulaire en formulaire.
2. **Inscription en une étape.** Un dialogue unique : recherche multi-sélection
   de participants existants **ou** création à la volée, puis `enroll()`.
   Aucune notion de « lot ».
3. **Modèle normalisé, zéro redondance.** Aucune valeur dérivée n'est stockée :
   `fullName`, `title`, `total`, `status`, années, mois arabe, ainsi que la
   formation et le niveau d'une inscription, sont **calculés à la lecture** par
   `src/services/derive.ts` — la seule source de vérité, importée par l'API
   **et** par l'UI.

## Modèle de données normalisé

```mermaid
erDiagram
    Training ||--o{ TrainingSession : "propose"
    Training }o--o{ TrainingLevel : "niveaux (M2N)"
    TrainingLevel |o--o{ TrainingSession : "niveau visé"
    TrainingSession ||--o{ Enrollment : "inscrits"
    TrainingSession ||--o{ StudentGroup : "groupes réels"
    Participant ||--o{ Enrollment : "inscriptions"
    Participant }o--o{ StudentCategory : "catégories (M2N)"
    Participant }o--|| Faculty : "faculté"
    Enrollment |o--|| TrainingLevel : "niveau attribué"
    Enrollment |o--|| StudentGroup : "groupe session / examen"
    Enrollment ||--o| PositioningScore : "1-1"
    Enrollment ||--o| DeliberationEntry : "1-1"
    PositioningTest ||--o{ PositioningScore : "notes"
    Participant ||--o{ PaymentReceipt : "reçus"
    DiplomaModel |o--o{ TrainingSession : "gabarit"
    Teacher |o--o{ StudentGroup : "enseignant"
```

### Note de dé-redondance

Le modèle historique dupliquait des données entre tables. Voici ce qui a été
supprimé, et pourquoi :

| Supprimé                                              | Remplacé par                                                          | Raison                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Entité `Lot`                                          | `TrainingSession` référence directement `training` et `trainingLevel` | Un lot n'ajoutait qu'un regroupement ; filtrer sur _formation + année_ suffit     |
| `StudentGroupsOrganization`                           | `StudentGroup.isTemplate`                                             | Deux tables aux colonnes identiques ; un booléen distingue gabarit et groupe réel |
| Entité `Deliberation`                                 | l'ensemble des `DeliberationEntry` d'une session                      | La table recopiait session/formation/niveau ; le seuil vit sur la session         |
| Participant re-référencé sur chaque évaluation        | `PositioningScore` et `DeliberationEntry` pointent vers `Enrollment`  | Le participant se retrouve en suivant `enrollment.participant`                    |
| `training` / `trainingLevel` copiés sur l'inscription | relation `enrollment.trainingSession`                                 | Une copie peut diverger de sa source ; la relation, non                           |

**Aucune valeur dérivée n'est stockée.** Ces champs n'existent dans aucune
table et sont calculés à la lecture par `src/services/derive.ts` :

`fullName` · `title` · `noteTotal` · `status` (admis/ajourné) · `yearFrom` ·
`yearTo` · `arabicMonthTo` · toute `training`/`trainingLevel` déductible d'une
relation parente.

Le seul compteur persistant est `SequenceCounter` : ce n'est pas une valeur
dérivée mais un **état d'allocation**, nécessaire pour garantir l'unicité des
matricules sous concurrence.

### Conventions

- **Intervalles de niveau semi-ouverts** `[minimumPoints, maximumPoints[` : un
  total de 50 tombe dans `B1.1 [50,60[`, jamais dans `A2.2 [40,50[`.
- **Ligne vierge ≠ zéro** : un total est `null` tant qu'aucune note n'est
  saisie, et le statut d'admission reste `null` (non délibéré) plutôt que
  « ajourné ».
- **Mois arabes** : convention algérienne (`جانفي`, `فيفري`, `مارس`…), utilisée
  sur les documents officiels.
- **Barème CECRL du seed** : 11 niveaux contigus sur 0..100, le total du
  positionnement étant la somme de deux notes écrites supposées sur 50.

## Tests

```bash
npm test              # 114 tests : unitaires purs + intégration sur PostgreSQL
```

Les règles qui dépendent réellement du moteur — atomicité des compteurs de
matricules, contrainte d'unicité des inscriptions, `onDelete: SetNull` lors de
la réorganisation des groupes — sont vérifiées **sur une vraie base**
(`ceil_test`), pas contre un mock de Prisma. Créez-la une fois :

```bash
createdb ceil_test
DATABASE_URL="postgresql://ceil:ceil@127.0.0.1:5432/ceil_test?schema=public" \
  npx prisma migrate deploy
```

Sans base joignable, les suites d'intégration sont **ignorées** plutôt que
rouges ; les tests purs, eux, tournent partout. Les fichiers s'exécutent en
série (`fileParallelism: false`) car ils partagent cette base et la remettent à
zéro entre chaque cas.

## Internationalisation

La langue est portée par le cookie `NEXT_LOCALE` (`fr` ou `ar`), pas par l'URL :
aucune duplication des routes sous un segment `[locale]`. Le `<html>` reçoit
`lang` et `dir` en conséquence, et la police arabe (Amiri) s'applique
automatiquement en RTL — y compris sur les documents imprimables.

## Licence

Usage interne — Université Abdelhamid Ibn Badis, Mostaganem.
