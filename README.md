# CEIL — application de gestion

Gestion du **Centre d'Enseignement Intensif des Langues** — Université Abdelhamid
Ibn Badis, Mostaganem.

L'application couvre le cycle complet : inscription des participants → test de
positionnement (niveau CECRL) → organisation en groupes → session de formation →
délibération (4 compétences, admission) → documents officiels (diplômes,
attestations, PV). Interface **bilingue français / arabe** avec RTL.

> **État actuel : étape 1 (scaffold) terminée.** La structure, l'outillage et la
> chaîne de build sont en place ; le modèle de données complet arrive à l'étape 2.

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
| `npm test`                    | Tests unitaires Vitest (services)        |
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

## Internationalisation

La langue est portée par le cookie `NEXT_LOCALE` (`fr` ou `ar`), pas par l'URL :
aucune duplication des routes sous un segment `[locale]`. Le `<html>` reçoit
`lang` et `dir` en conséquence, et la police arabe (Amiri) s'applique
automatiquement en RTL — y compris sur les documents imprimables.

## Licence

Usage interne — Université Abdelhamid Ibn Badis, Mostaganem.
