# Journal des décisions

Chaque décision structurante, sa raison et ses conséquences. **Rien n'est
supprimé ici** : une décision abandonnée est marquée _Obsolète_ et renvoie vers
celle qui la remplace — savoir ce qui a été essayé évite de le réessayer.

| Nº            | Décision                                                   | Statut                |
| ------------- | ---------------------------------------------------------- | --------------------- |
| [D-01](#d-01) | Pile technique imposée                                     | Accepté               |
| [D-02](#d-02) | Modèle normalisé, zéro redondance                          | Accepté               |
| [D-03](#d-03) | `derive.ts` pur, partagé client et serveur                 | Accepté               |
| [D-04](#d-04) | Intervalles de niveau semi-ouverts                         | Accepté               |
| [D-05](#d-05) | Ligne vierge ≠ zéro : le statut peut être « non délibéré » | Accepté — à confirmer |
| [D-06](#d-06) | Allocation atomique des matricules                         | Accepté               |
| [D-07](#d-07) | Matricule d'inscription unique **par session**             | Accepté               |
| [D-08](#d-08) | Un groupe cible un niveau ; plusieurs groupes par niveau   | Accepté               |
| [D-09](#d-09) | Verrouillage en 409 `LOCKED`, distinct de `CONFLICT`       | Accepté               |
| [D-10](#d-10) | Enveloppe d'erreur unique, erreurs Prisma traduites        | Accepté               |
| [D-11](#d-11) | RBAC vérifié côté serveur, sans exception                  | Accepté               |
| [D-12](#d-12) | Garde d'authentification dans le layout, pas le middleware | Accepté               |
| [D-13](#d-13) | Locale par cookie, pas par segment d'URL                   | Accepté               |
| [D-14](#d-14) | Inscription en une seule étape                             | Accepté               |
| [D-15](#d-15) | Le diplôme est réservé aux admis                           | Accepté               |
| [D-16](#d-16) | Saisie en grille : état local et rendu différé             | Accepté               |
| [D-17](#d-17) | Tests d'intégration sur une vraie base, en série           | Accepté               |
| [D-18](#d-18) | Tests e2e en série sur `localhost`                         | Accepté               |
| [D-19](#d-19) | Habillage léger plutôt qu'aplat blanc                      | Accepté               |
| [D-20](#d-20) | Import : rapport détaillé, jamais de perte silencieuse     | Accepté               |
| [D-21](#d-21) | La documentation d'import est verrouillée par un test      | Accepté               |
| [D-22](#d-22) | Le modèle d'import est généré, pas maintenu à la main      | Accepté               |
| [D-23](#d-23) | Lecture des dates de naissance : jour d'abord              | Accepté               |
| [D-24](#d-24) | Mois arabes en convention algérienne                       | Accepté — à confirmer |
| [D-25](#d-25) | La documentation du dépôt est la mémoire du projet         | Accepté               |
| [D-26](#d-26) | L'attestation est un gabarit ODT téléversé                 | Accepté               |
| [D-27](#d-27) | Le gabarit est stocké en base, pas sur un volume           | Accepté               |

---

## D-01

### Pile technique imposée

_2026-07-28 · Accepté_

Next.js App Router + TypeScript strict, Prisma + PostgreSQL, NextAuth (Auth.js),
Tailwind + shadcn/ui, TanStack Table, `xlsx`/`papaparse`, next-intl, Zod,
Vitest + Playwright, documents imprimables en HTML→PDF.

**Raison** : pile fixée par la commande. Elle n'est pas rediscutée ; les
versions exactes sont dans `package.json`.

**Conséquence** : pas de génération PDF côté serveur — les documents sont des
pages HTML mises en page en A4, imprimées par le navigateur.

## D-02

### Modèle normalisé, zéro redondance

_2026-07-28 · Accepté · migration `20260728170655_init_normalized_model`_

Le modèle d'origine dupliquait des données entre tables. Quatre suppressions :
entité `Lot`, table `StudentGroupsOrganization`, entité `Deliberation`, et les
copies de `training`/`trainingLevel` sur l'inscription. Détail et remplacements :
[`README`](../README.md#note-de-dé-redondance).

**Raison** : une copie peut diverger de sa source, une relation non. Un lot
n'ajoutait qu'un regroupement que le couple _formation + année_ donne déjà.

**Conséquence** : plus de jointures à la lecture, et l'obligation de dériver —
voir D-03.

## D-03

### `derive.ts` pur, partagé client et serveur

_2026-07-28 · Accepté_

Toutes les valeurs calculées vivent dans `src/services/derive.ts`, sans aucun
import de Prisma, de React ni du DOM.

**Raison** : la pureté est ce qui autorise le **navigateur** à importer les
fonctions du serveur. Une grille affiche donc exactement ce que la base
retiendra, sans réimplémenter une règle.

**Conséquence** : y ajouter une dépendance à Prisma casserait silencieusement
les grilles. Un test e2e vérifie la concordance saisie → enregistrement →
rechargement.

## D-04

### Intervalles de niveau semi-ouverts

_2026-07-28 · Accepté_

Un niveau CECRL couvre `[minimumPoints, maximumPoints[`.

**Raison** : avec des bornes fermées, un total de 50 appartiendrait à la fois à
`A2.2 [40,50]` et à `B1.1 [50,60]`. Le semi-ouvert rend la résolution
déterministe sans règle de départage.

## D-05

### Ligne vierge ≠ zéro

_2026-07-28 · Accepté — à confirmer par le CEIL_

Tant qu'aucune note n'est saisie, le total vaut `null` et le statut reste **non
délibéré**, ni admis ni ajourné.

**Raison** : la spécification ne prévoyait que `{admis, refusé}`. Compter une
ligne vide comme ajournée reviendrait à prononcer un échec faute de saisie.

**Conséquence** : le statut est un sur-ensemble de la spécification. À valider
avec le CEIL — voir `etat-du-projet.md`.

## D-06

### Allocation atomique des matricules

_2026-07-28 · Accepté_

Le numéro suivant est obtenu par un seul `INSERT … ON CONFLICT DO UPDATE …
RETURNING` sur `sequence_counters`.

**Raison** : un `SELECT` puis `UPDATE` laisse deux inscriptions simultanées
repartir du même numéro. Un matricule en double sur un diplôme n'est pas
rattrapable.

**Conséquence** : `SequenceCounter` est la seule table de compteur persistante.
Toute insertion directe en base doit l'initialiser — voir
[`exploitation.md`](./exploitation.md).

## D-07

### Le matricule d'inscription est unique par session

_2026-07-28 · Accepté · migration `20260728172215_enrollment_number_unique_per_session`_

Contrainte `@@unique([trainingSessionId, registrationNumber])`, et non une
unicité globale.

**Raison** : défaut trouvé par un test. Deux sessions partageant le même
`matriculePrefix` produisaient toutes deux `CEIL-ANG-0001` ; la seconde échouait.
Deux sessions peuvent légitimement partager un préfixe.

## D-08

### Un groupe cible un niveau, et un niveau peut compter plusieurs groupes

_2026-07-28 · Accepté · migration `20260728173916_group_training_level`_

`StudentGroup.trainingLevelId` est nullable ; un couple (session, niveau) peut
avoir « Groupe 1 » à « Groupe 5 ».

**Raison** : décision métier de l'utilisateur. Une session est multi-niveaux, et
le nombre de groupes dépend de l'effectif et de la capacité des salles. Les
groupes sont donc organisés **après** le test de positionnement, quand le niveau
de chacun est connu.

**Conséquence** : `organizeGroupsByLevel` ouvre `plafond(effectif ÷ capacité)`
groupes par niveau ; les inscrits sans niveau attribué sont comptés à part
plutôt que placés au hasard.

## D-09

### Verrouillage en 409 `LOCKED`, distinct de `CONFLICT`

_2026-07-28 · Accepté_

Une session ou un test verrouillé refuse toute écriture, **avant** de toucher la
base, avec un code d'erreur propre.

**Raison** : « la session est close » et « ce matricule existe déjà » appellent
deux gestes différents de l'utilisateur. Un seul code les rendrait
indiscernables côté client.

## D-10

### Enveloppe d'erreur unique, erreurs Prisma traduites

_2026-07-28 · Accepté_

`{ error, message, details? }`, produit par un wrapper unique. `P2002 → 409`,
`P2025 → 404`, `P2003 → 409` explicite sur la référence.

**Raison** : un message Prisma brut expose la structure de la base et n'aide pas
l'utilisateur. Une forme unique permet au client de traiter les erreurs sans
connaître la route.

## D-11

### RBAC vérifié côté serveur, sans exception

_2026-07-28 · Accepté_

`MANAGER`/`ADMIN` en CRUD complet ; `USER` en lecture seule sur `Training`,
`TrainingLevel` et `PaymentReceipt` ; la ressource `User` est réservée à `ADMIN`
**y compris en lecture**.

**Raison** : masquer une entrée de menu est du confort d'affichage, pas une
protection — une URL se saisit à la main. Un `MANAGER` ne doit pas pouvoir
énumérer les comptes.

**Conséquence** : trois garde-fous empêchent le dernier administrateur de
s'enfermer dehors (retrait de son propre rôle, désactivation, suppression).

## D-12

### Garde d'authentification dans le layout, pas dans le middleware

_2026-07-28 · Accepté_

La garde vit dans le layout `(app)` ; le middleware est réduit à exposer le
chemin demandé dans `x-ceil-pathname`.

**Raison** : le provider credentials dépend de bcrypt et du client Prisma,
incompatibles avec le runtime edge d'un middleware. Mais un layout n'a pas accès
à l'URL courante : sans l'en-tête, impossible de revenir à la page demandée
après connexion. Défaut trouvé par un test e2e.

## D-13

### Locale par cookie, pas par segment d'URL

_2026-07-28 · Accepté_

`NEXT_LOCALE` porte `fr` ou `ar`.

**Raison** : un segment `[locale]` dupliquerait l'arborescence complète des
routes pour un bénéfice nul ici — l'application est interne, non indexée.

## D-14

### Inscription en une seule étape

_2026-07-28 · Accepté_

Un dialogue unique : recherche multi-sélection de participants existants **ou**
création à la volée, puis `enroll()`, le tout en une transaction.

**Raison** : principe posé par la commande. Aucune notion de « lot »
intermédiaire, qui ajoutait une étape sans rien apporter.

**Conséquence** : un participant déjà inscrit est **ignoré sans erreur** plutôt
que de faire échouer la sélection entière.

## D-15

### Le diplôme est réservé aux admis

_2026-07-29 · Accepté_

Le filtre est appliqué **dans le service**, pas laissé à l'appelant. Demander
explicitement le diplôme d'un ajourné renvoie 422, distinct du 404 d'une
inscription inconnue.

**Raison** : un diplôme délivré à tort est une faute réglementaire. La règle ne
peut pas dépendre de la vigilance d'un écran.

**Conséquence** : si le `DiplomaModel` de la session est absent **ou
désactivé**, le modèle par défaut prend le relais — désactiver un modèle ne doit
pas empêcher d'imprimer.

## D-16

### Saisie en grille : état local et rendu différé

_2026-07-29 · Accepté_

Chaque cellule tient son état local, resynchronisé sur la prop **uniquement hors
focus** ; la remontée au parent passe par `startTransition` ; les colonnes sont
mémorisées par signature de structure.

**Raison** : bug signalé par l'utilisateur — impossible de taper « 10 » d'un
seul geste. Deux causes cumulées : chaque frappe re-rendait la grille entière
(150 lignes × 9 colonnes), et la resynchronisation écrasait les caractères
saisis parce que la valeur du parent avait un rendu de retard.

**Conséquence** : les tests utilisant `fill()` ne pouvaient pas le voir.
`e2e/typing.spec.ts` tape désormais **caractère par caractère** sur une session
de 60 lignes.

## D-17

### Tests d'intégration sur une vraie base, en série

_2026-07-28 · Accepté_

Base `ceil_test`, `fileParallelism: false`, suites **ignorées** si aucune base
n'est joignable.

**Raison** : atomicité des compteurs, contraintes d'unicité et `onDelete` ne
prouvent rien contre un mock de Prisma. Les fichiers partagent la base et la
remettent à zéro : les paralléliser produisait 49 échecs de troncature.

## D-18

### Tests e2e en série sur `localhost`

_2026-07-29 · Accepté_

`mode: 'serial'`, et `baseURL` sur `localhost` et non `127.0.0.1`.

**Raison** : c'est la continuité du cycle métier qui est éprouvée, pas des
gestes isolés. Et viser un hôte différent d'`AUTH_URL` fait poser le cookie de
session sur l'un et le relire sur l'autre : la connexion échoue sans erreur
visible — piège de déploiement autant que de test.

## D-19

### Habillage léger plutôt qu'aplat blanc

_2026-07-29 · Accepté_

Fond légèrement teinté, cartes surélevées, en-tête collant, tableaux zébrés.

**Raison** : demande de l'utilisateur, l'interface étant « trop blanche ».
L'option retenue reste neutre en attendant l'identité visuelle du CEIL
(couleurs et logo de l'université).

## D-20

### Import : rapport détaillé, jamais de perte silencieuse

_2026-07-28 · Accepté_

Chaque import renvoie créés / rapprochés / inscrits / ignorés, les matricules
sans correspondance, et les lignes en erreur **avec leur numéro de ligne dans le
fichier**. Le rapprochement ne se fait **jamais sur le seul nom**.

**Raison** : trois défauts trouvés par les tests — diacritiques arabes bloquant
la correspondance, ligne porteuse de données mais sans nom disparaissant en
silence, ligne identifiée par le seul matricule rejetée à tort. Faire
disparaître un inscrit sans le dire est pire qu'un échec. Et deux homonymes sont
deux personnes.

## D-21

### La documentation d'import est verrouillée par un test

_2026-07-29 · Accepté_

`tests/services/import-headers.test.ts` vérifie chaque intitulé annoncé dans
`docs/import-excel.md`, cas négatifs compris.

**Raison** : la page affirmait que `N°` était reconnu — il ne l'était pas, la
normalisation le réduisant à `n`. Plutôt que d'affaiblir la documentation, le
code a été rendu conforme (`°` → `o`). Un `N` seul reste volontairement non
reconnu : c'est presque toujours un numéro de ligne.

**Conséquence** : la page ne peut plus promettre un intitulé que le code
refuserait.

## D-22

### Le modèle d'import est généré, pas maintenu à la main

_2026-07-29 · Accepté_

`npm run docs:template` produit `docs/modele-import-ceil.xlsx`, et un test relit
ce fichier avec le code qui l'importera.

**Raison** : un classeur d'exemple maintenu à la main dérive du format réel sans
que personne ne s'en aperçoive — jusqu'à ce qu'un utilisateur s'en serve.

## D-23

### Lecture des dates de naissance : jour d'abord

_2026-07-29 · Accepté_

Cellule date Excel et sérial lus tels quels ; texte interprété jour d'abord,
avec rattrapage d'un fichier anglais dès que le second nombre dépasse 12 ; année
sur deux chiffres jamais projetée dans le futur ; année seule ou « vers 1975 »
rangée dans `approximateBirth`.

**Raison** : la date et le lieu de naissance s'impriment sur les diplômes, et
une date mal lue ne se voit que des mois plus tard. Inventer un 1er janvier
serait plus grave que de rester approximatif.

**Conséquence** : sur un participant rapproché, l'import **complète les champs
vides** mais n'écrase jamais une saisie — une divergence est reportée pour
arbitrage humain, un fichier n'étant pas plus fiable qu'une saisie.

## D-24

### Mois arabes en convention algérienne

_2026-07-28 · Accepté — à confirmer par le CEIL_

`جانفي`, `فيفري`, `مارس`… plutôt que la nomenclature du Machrek.

**Raison** : usage algérien, cohérent avec les documents officiels locaux. Les
formulations arabes et françaises des diplômes restent une **rédaction
provisoire**, en attente du texte réglementaire du CEIL.

## D-25

### La documentation du dépôt est la mémoire du projet

_2026-07-29 · Accepté_

`CLAUDE.md` en point d'entrée, `docs/architecture.md`, `docs/decisions.md`,
`docs/etat-du-projet.md`, `docs/exploitation.md`, `CHANGELOG.md`. Une
information vit à un seul endroit ; les fichiers se renvoient l'un à l'autre.

**Raison** : le projet doit pouvoir être repris par un développeur ou une
nouvelle session IA sans perte de contexte. Un choix non écrit est un choix
qu'on refera autrement.

**Conséquence** : toute évolution du modèle, d'une API, d'une convention ou
d'une limite connue met à jour ces fichiers **dans le même commit**.

## D-26

### L'attestation de réussite est un gabarit ODT téléversé

_2026-07-30 · Accepté_

La mise en page de l'attestation ne vit plus dans le code. L'administration
prépare un `.odt` dans LibreOffice Writer, y place des repères `{{…}}`, et le
téléverse ; l'application ne remplit que les valeurs variables et confie la
conversion PDF à LibreOffice en mode `--headless`.

**Raison** : demande explicite de l'utilisateur — pouvoir changer le document
rapidement, sans développeur. Un document officiel change au gré d'un texte
réglementaire, d'un logo ou d'une signature ; l'attendre d'une livraison de code
est une contrainte disproportionnée.

**Alternatives écartées** :

- _Gabarit HTML modifiable dans l'application_ : aucune dépendance système, mais
  la mise en page ne se prépare plus dans LibreOffice — précisément ce que
  l'utilisateur voulait éviter.
- _Fond exporté en image + champs positionnés_ : sans dépendance non plus, mais
  impose de régler une dizaine de positions à chaque nouveau fond.
- _Conversion de l'ODT en HTML au téléversement_ : garderait l'impression dans le
  navigateur, mais la conversion HTML de LibreOffice rend mal les cadres et fonds
  décoratifs — la fidélité, seul intérêt du procédé, serait perdue.

**Conséquence** : LibreOffice devient la **seule dépendance système** de
l'application, confinée à `src/services/odt-render.ts`, et le principe « pas de
PDF côté serveur » de [D-01](#d-01) ne vaut plus pour ce document. Les autres
documents — procès-verbal, listes d'émargement — restent des pages HTML : leur
mise en page est tabulaire, pas protocolaire.

**Ce que les tests ont révélé** : sans `META-INF/manifest.xml`, LibreOffice
**rend la main sans produire de PDF ni d'erreur**. Le manifeste est donc vérifié
au téléversement, faute de quoi le défaut se découvrirait à l'impression. De
même, deux conversions partageant un profil utilisateur se bloquent en silence :
chaque conversion reçoit désormais un profil jetable.

## D-27

### Le gabarit est stocké en base, pas sur un volume

_2026-07-30 · Accepté · migration `20260730000204_certificate_odt_template`_

Table `document_templates`, colonne `content` en `BYTEA`, une entrée par modèle
de diplôme et par type de document.

**Raison** : une sauvegarde `pg_dump` suffit alors à restaurer les documents
officiels, et un déploiement sans stockage partagé reste possible. Un fichier sur
disque se serait désynchronisé de la base à la première restauration.

**Conséquence** : le contenu ne doit **jamais** traverser une réponse de liste,
où il serait sérialisé en base64 pour chaque modèle. Le CRUD des modèles de
diplôme n'expose que les métadonnées ; le fichier a sa route de téléchargement.

La taille et la liste des repères ne sont pas stockées : elles se relisent depuis
`content`, conformément à la règle « aucune valeur dérivée en base ».
