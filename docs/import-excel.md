# Imports Excel / CSV

L'application accepte trois imports, tous depuis l'**espace de travail d'une
session** : les inscrits, les notes de positionnement et les notes de
délibération.

Un modèle prêt à l'emploi est fourni : [`modele-import-ceil.xlsx`](./modele-import-ceil.xlsx).
Il contient une feuille par import. **Régénérez-le après toute évolution du
format** :

```bash
npm run docs:template
```

---

## Règles communes

| Point                | Règle                                                          |
| -------------------- | -------------------------------------------------------------- |
| Formats acceptés     | `.xlsx`, `.xls`, `.csv`                                        |
| Feuille lue          | **la première uniquement** — découpez votre classeur si besoin |
| En-têtes             | **première ligne** du tableau                                  |
| Ordre des colonnes   | libre                                                          |
| Colonnes inutilisées | peuvent être absentes                                          |
| Session verrouillée  | import refusé **avant** toute écriture (409)                   |

### Les en-têtes sont normalisés

Casse, accents et ponctuation sont ignorés : `Prénom`, `PRENOM`, `prenom` et
`Prénom :` sont équivalents. Les **diacritiques arabes** le sont aussi — `أستاذ`
et `استاذ` désignent la même chose.

Concrètement, vous n'avez pas à reproduire les intitulés au caractère près.
`N°` est également compris comme « numéro ». En revanche, un **`N` seul n'est pas
reconnu** comme matricule : c'est presque toujours un numéro de ligne.

Ces équivalences sont verrouillées par un test (`tests/services/import-headers.test.ts`) :
cette page ne peut pas promettre un intitulé que le code n'accepterait pas.

### Rien ne disparaît en silence

Chaque import renvoie un rapport affiché à l'écran :

- nombre de participants **créés**, **rapprochés** et de fiches **complétées**,
  d'inscriptions **créées** et **ignorées** ;
- **matricules sans correspondance**, listés un par un ;
- **lignes en erreur avec leur numéro de ligne dans le fichier**, en-tête
  comprise — le même numéro que celui affiché par Excel.

Les lignes entièrement vides sont sautées sans bruit. En revanche, une ligne qui
porte des données mais aucun identifiant exploitable est **signalée** : faire
disparaître un participant sans le dire serait pire qu'un échec.

---

## 1. Import des inscrits

Onglet **Inscrits** → bouton « Importer des inscrits ».

### Colonnes

| Colonne                   | Autres intitulés acceptés                            | Obligatoire      |
| ------------------------- | ---------------------------------------------------- | ---------------- |
| `Nom`                     | `Nom de famille`, `Family name`, `اللقب`             | l'un des trois ✻ |
| `Prénom`                  | `Prénoms`, `First name`, `الاسم`                     | ✻                |
| `Nom arabe`               | `Nom ar`, `اللقب بالعربية`                           | ✻                |
| `Prénom arabe`            | `Prénom ar`, `الاسم بالعربية`                        | non              |
| `Date de naissance`       | `Naissance`, `Né le`, `Né(e) le`, `تاريخ الميلاد`    | non              |
| `Lieu de naissance`       | `Né à`, `Née à`, `مكان الميلاد`                      | non              |
| `Lieu de naissance arabe` | `مكان الميلاد بالعربية`                              | non              |
| `Type`                    | `Catégorie`, `الصفة`                                 | non              |
| `Téléphone`               | `Tél`, `Phone`, `الهاتف`                             | non              |
| `Email`                   | `Mail`, `Courriel`                                   | non              |
| `Matricule`               | `Numéro`, `N°`, `Registration number`, `رقم التسجيل` | non              |

✻ Il faut **au moins un nom** (latin ou arabe) **ou** un matricule.

Date et lieu de naissance ne servent pas qu'à la fiche : ils **s'impriment sur
les diplômes et les attestations**. Les importer évite de les ressaisir un à un.

### Colonne `Type`

`Enseignant`, `ENS`, `Prof`, `Professeur`, `أستاذ` → participant **enseignant**.
Toute autre valeur, ou colonne absente → **étudiant**.

### Colonne `Date de naissance`

| Ce que contient la cellule               | Lu comme                                                           |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Une **vraie cellule date** Excel         | la date, sans ambiguïté — le plus sûr                              |
| `28/07/1998`, `28-07-1998`, `28.07.1998` | 28 juillet 1998                                                    |
| `1998-07-28`                             | 28 juillet 1998                                                    |
| `28/07/98`                               | 1998 — l'année à deux chiffres n'est jamais projetée dans le futur |
| `7/28/1998` (fichier anglais)            | 28 juillet 1998                                                    |
| `1998`                                   | naissance **approximative** : « 1998 »                             |
| `vers 1975`, `حوالي 1975`                | naissance **approximative**, mention conservée telle quelle        |
| Autre chose                              | ligne **conservée**, date **signalée** en erreur                   |

**Le jour vient en premier.** `03/04/1998` est lu 3 avril, pas 4 mars. Un fichier
exporté en anglais est malgré tout bien lu dès que le second nombre dépasse 12
(`7/28/1998`), puisqu'il ne peut alors pas être un mois. Pour les dates
réellement ambiguës, la seule façon d'être sûr est d'utiliser une **cellule de
type date** plutôt que du texte.

Une année seule ou une mention « vers … » n'est pas transformée en 1er janvier :
elle est rangée dans la **date approximative** de la fiche, et c'est elle qui
s'affiche. Inventer un jour serait plus grave que de rester approximatif.

Une date illisible ne fait **pas perdre la ligne** : le participant est créé et
inscrit, et la date est listée dans le rapport pour être corrigée.

### Colonne `Matricule` — le point à connaître

| Valeur                                 | Effet                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Vide                                   | Un participant est **créé**, avec un matricule attribué automatiquement (`PART-ETU-2026-0001`) |
| Renseignée et **connue**               | Le participant existant est **rapproché**, jamais dupliqué                                     |
| Renseignée mais **inconnue**, sans nom | Ligne **signalée en erreur** : on ne crée pas quelqu'un sans nom                               |

Pour réinscrire d'anciens participants, le matricule **seul suffit** : inutile de
recopier noms et coordonnées.

#### Compléter une fiche existante

Quand la ligne rapproche un participant déjà connu, l'import **remplit les
champs d'état civil restés vides** (date, lieu de naissance) et compte la fiche
dans « complétée(s) ».

Il **n'écrase jamais une valeur déjà saisie**. Si le fichier dit autre chose que
la fiche, la fiche est laissée telle quelle et la divergence est listée dans le
rapport : un fichier n'est pas plus fiable qu'une saisie, l'arbitrage revient à
une personne.

> Le rapprochement ne se fait **jamais sur le seul nom** : deux homonymes sont
> deux personnes différentes. Sans matricule, un participant est créé.

### Déroulement

L'import crée les participants absents **puis** les inscrit à la session, en une
seule opération transactionnelle. Un participant **déjà inscrit** à cette session
est ignoré sans erreur et compté dans « ignorés ».

### Exemple

| Matricule            | Nom     | Prénom | Nom arabe | Date de naissance | Lieu de naissance | Type       | Téléphone  |
| -------------------- | ------- | ------ | --------- | ----------------- | ----------------- | ---------- | ---------- |
|                      | BENALI  | Amina  | بن علي    | 28/07/1998        | Mostaganem        | Étudiant   | 0550112233 |
|                      | ZEROUAL | Karim  |           | vers 1975         | Oran              | Enseignant | 0661445566 |
| `PART-ETU-2026-0001` |         |        |           |                   |                   |            |            |

---

## 2. Import des notes de positionnement

Onglet **Positionnement** → bouton « Importer les notes ». Un test doit être
sélectionné.

| Colonne     | Autres intitulés acceptés                     |
| ----------- | --------------------------------------------- |
| `Matricule` | `Numéro`, `N°`, `رقم التسجيل`                 |
| `E.E`       | `EE`, `Expression écrite`, `التعبير الكتابي`  |
| `C.E`       | `CE`, `Compréhension écrite`, `الفهم الكتابي` |

Le **matricule accepté** est celui de l'inscription **ou** celui du participant.

Le total (`E.E + C.E`) et le niveau résolu sont **calculés**, jamais importés :
ils se déduisent des intervalles CECRL. Un import ne peut donc pas introduire un
niveau incohérent avec les notes.

Les notes dont la session est verrouillée sont ignorées et signalées ligne par
ligne, plutôt que de faire échouer tout le fichier.

---

## 3. Import des notes de délibération

Onglet **Notes / Délibération** → bouton « Importer les notes ».

| Colonne     | Autres intitulés acceptés                     |
| ----------- | --------------------------------------------- |
| `Matricule` | `Numéro`, `N°`, `رقم التسجيل`                 |
| `E.O`       | `EO`, `Expression orale`, `التعبير الشفوي`    |
| `E.E`       | `EE`, `Expression écrite`, `التعبير الكتابي`  |
| `C.O`       | `CO`, `Compréhension orale`, `الفهم الشفوي`   |
| `C.E`       | `CE`, `Compréhension écrite`, `الفهم الكتابي` |

Le total et le statut (admis / ajourné) sont **dérivés** du seuil de la session —
ils ne s'importent pas. Une ligne sans aucune note reste « non délibérée », elle
n'est pas comptée comme ajournée.

---

## Format des nombres

La **virgule décimale est acceptée** : `12,5` et `12.5` donnent la même note. Les
espaces autour des valeurs sont ignorés.

Une cellule vide signifie « note non saisie », ce qui **n'équivaut pas à zéro** :
une ligne sans note reste non délibérée, tandis qu'un `0` explicite compte dans
le total.

---

## Alternative au fichier : le collage direct

Pour quelques dizaines de lignes, il est souvent plus rapide de **copier une
plage depuis Excel et de la coller directement dans la grille**. Le collage
remplit vers la droite et vers le bas à partir de la cellule sélectionnée, et
saute les colonnes calculées.
