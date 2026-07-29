# Historique

Livraisons de la plus récente à la plus ancienne. Le **pourquoi** de chaque
choix est dans [`docs/decisions.md`](./docs/decisions.md) ; l'état actuel dans
[`docs/etat-du-projet.md`](./docs/etat-du-projet.md).

## 2026-07-29

### Mémoire du projet — étape 10

`CLAUDE.md` en point d'entrée, `docs/architecture.md`, `docs/decisions.md`,
`docs/etat-du-projet.md`, `docs/exploitation.md` et ce fichier. Le dépôt peut
être repris sans contexte préalable. ([D-25](./docs/decisions.md#d-25))

Corrige au passage la dérive du `README` : compteurs de tests obsolètes, onglet
Documents annoncé comme à venir alors qu'il est livré.

### Import de l'état civil des inscrits — `778bf2a`

Date et lieu de naissance importables, alors qu'ils s'impriment sur les
diplômes. Cellules date Excel, sérials, texte jour d'abord, mentions
approximatives (« vers 1975 »). Sur un participant rapproché, l'import complète
les champs vides et n'écrase jamais une saisie.
([D-23](./docs/decisions.md#d-23))

### Documentation du format d'import — `f401002`

`docs/import-excel.md`, modèle `modele-import-ceil.xlsx` généré par script,
et 43 tests verrouillant les intitulés annoncés. La page promettait `N°` que le
code refusait : le code a été rendu conforme plutôt que la page affaiblie.
([D-21](./docs/decisions.md#d-21), [D-22](./docs/decisions.md#d-22))

### Habillage — `ceee88c`

Sortie de l'aplat blanc : fond teinté, cartes surélevées, tableaux zébrés,
en-tête collant. ([D-19](./docs/decisions.md#d-19))

### Correction — des caractères se perdaient à la saisie des notes — `aa1ea38`

Défaut signalé par l'utilisateur : impossible de taper « 10 » d'un seul geste.
État local par cellule, remontée différée, colonnes mémorisées. Les tests
utilisant `fill()` ne pouvaient pas le voir ; `e2e/typing.spec.ts` tape
désormais caractère par caractère. ([D-16](./docs/decisions.md#d-16))

## 2026-07-28

### Étape 9 — parcours e2e complet — `5c8246e`

44 tests Playwright, dont un cycle métier de 13 étapes enchaînées sur une même
session. Le verrouillage est vérifié à l'écran **et** sur requête forgée.
Révèle un défaut réel de mémorisation des colonnes de la grille.
([D-18](./docs/decisions.md#d-18))

### Étape 8 — documents officiels — `64c68e2`

Procès-verbal, diplômes, attestations, listes d'émargement : HTML en A4,
bilingues, imprimables. Le diplôme est réservé aux admis, filtre appliqué dans
le service. ([D-15](./docs/decisions.md#d-15))

### Étape 7 — CRUD des référentiels et du catalogue — `87e69d0`

Treize écrans pilotés par une description de champs plutôt que treize
formulaires — treize copies auraient donné treize divergences.

### Étape 6 — espace de travail Session — `fbb6729`

L'écran d'utilisation quotidienne : onglets Inscrits, Positionnement,
Délibération, Groupes ; grilles éditables, collage Excel, colonnes calculées en
direct par les mêmes fonctions que le serveur.

### Étape 5 — authentification, rôles et shell — `59baa04`

Auth.js v5 en credentials, session JWT portant le rôle, garde dans le layout et
middleware réduit au chemin demandé. ([D-12](./docs/decisions.md#d-12))

### Étape 4 — API REST, RBAC serveur, erreurs — `7b8f9c0`

51 Route Handlers derrière un wrapper unique, enveloppe d'erreur unique, tri
restreint aux colonnes déclarées.
([D-10](./docs/decisions.md#d-10), [D-11](./docs/decisions.md#d-11))

### Groupes de session par niveau CECRL — `871915e`

Une session est multi-niveaux ; un couple (session, niveau) peut compter
plusieurs groupes selon l'effectif et la capacité des salles. Décision métier de
l'utilisateur. ([D-08](./docs/decisions.md#d-08))

### Étape 3 — couche services métier — `1a57cfb`

Services testés sur une vraie base PostgreSQL. Deux défauts réels trouvés par
les tests : matricule d'inscription unique globalement au lieu de par session,
et diacritiques arabes bloquant les correspondances à l'import.
([D-06](./docs/decisions.md#d-06), [D-07](./docs/decisions.md#d-07),
[D-17](./docs/decisions.md#d-17), [D-20](./docs/decisions.md#d-20))

### Étape 2 — modèle normalisé, dérivés et seed — `c0bdcca`

15 modèles, 8 énumérations, aucune valeur dérivée stockée. Suppression de `Lot`,
`StudentGroupsOrganization` et `Deliberation`.
([D-02](./docs/decisions.md#d-02), [D-03](./docs/decisions.md#d-03),
[D-04](./docs/decisions.md#d-04), [D-05](./docs/decisions.md#d-05))

### Étape 1 — scaffold — `e785549`

Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui, Prisma,
Vitest et Playwright. ([D-01](./docs/decisions.md#d-01))
