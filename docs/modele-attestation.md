# Gabarit d'attestation (LibreOffice)

La mise en page de l'**attestation de réussite** n'est pas dans le code : c'est
un fichier `.odt` que vous préparez dans **LibreOffice Writer** et que vous
téléversez. Pour la changer, vous remplacez le fichier — rien d'autre.

Un gabarit de départ est fourni : [`modele-attestation.odt`](./modele-attestation.odt).
Il reprend la structure de l'attestation délivrée par le centre, en **A4 paysage**.

---

## En trois gestes

1. **Ouvrez** `modele-attestation.odt` dans LibreOffice Writer.
2. **Mettez-le à votre main** : logos, cadre, polices, signature, QR code,
   mentions légales. Gardez les repères `{{…}}` là où vous voulez voir apparaître
   les données de chaque personne.
3. **Téléversez-le** : _Référentiels → Modèles de diplôme → Téléverser_.

L'application vous répond aussitôt combien de repères elle a reconnus, et
signale ceux qu'elle ne sait pas remplir.

> Pour repartir du fichier **en production** plutôt que d'une copie locale qui a
> pu diverger, utilisez le bouton de **téléchargement** à côté du gabarit.

---

## Ce que l'application remplit

Elle ne touche **qu'aux repères**. Tout le reste du document est à vous et n'est
jamais modifié : en-têtes officiels, images, cadres, styles, pied de page.

Un repère s'écrit entre doubles accolades : `{{nomLatin}}`.

### Identité

| Repère                | Contenu                                    |
| --------------------- | ------------------------------------------ |
| `{{nomLatin}}`        | Nom de famille en caractères latins        |
| `{{prenomLatin}}`     | Prénom en caractères latins                |
| `{{nomComplet}}`      | Nom et prénom latins                       |
| `{{nomArabe}}`        | Nom de famille en arabe                    |
| `{{prenomArabe}}`     | Prénom en arabe                            |
| `{{nomCompletArabe}}` | Nom et prénom en arabe                     |
| `{{civiliteArabe}}`   | `السيد` / `السيدة` selon le sexe renseigné |

`{{civiliteArabe}}` vaut `السيد(ة)` tant que le sexe n'est pas saisi sur la fiche
du participant : une attestation officielle ne doit pas se tromper de personne.

### État civil

| Repère                     | Contenu                            |
| -------------------------- | ---------------------------------- |
| `{{dateNaissance}}`        | `27/10/2005`                       |
| `{{dateNaissanceInverse}}` | `2005/10/27` — format de l'exemple |
| `{{lieuNaissance}}`        | Lieu de naissance, latin           |
| `{{lieuNaissanceArabe}}`   | Lieu de naissance, arabe           |

### Formation et session

| Repère                   | Contenu                                     |
| ------------------------ | ------------------------------------------- |
| `{{langue}}`             | Langue de la formation, en français         |
| `{{langueArabe}}`        | Langue de la formation, en arabe            |
| `{{niveau}}`             | Niveau CECRL obtenu, ex. `B1.2`             |
| `{{sessionArabe}}`       | `دورة أكتوبر 2025` — mois de début et année |
| `{{session}}`            | Intitulé de la session                      |
| `{{anneeUniversitaire}}` | ex. `2025-2026`                             |
| `{{moisArabeDebut}}`     | Mois de début de session, en arabe          |
| `{{moisArabeFin}}`       | Mois de fin de session, en arabe            |
| `{{anneeDebut}}`         | Année de début                              |
| `{{anneeFin}}`           | Année de fin                                |

### Identifiants, résultats et date

| Repère                      | Contenu                              |
| --------------------------- | ------------------------------------ |
| `{{matricule}}`             | Matricule d'inscription à la session |
| `{{matriculeParticipant}}`  | Matricule permanent du participant   |
| `{{total}}`                 | Total des quatre compétences         |
| `{{seuil}}`                 | Seuil d'admission de la session      |
| `{{dateDelivrance}}`        | Date d'édition, `12/04/2026`         |
| `{{dateDelivranceInverse}}` | Date d'édition, `2026/04/12`         |

Cette liste est aussi consultable **dans l'application**, bouton « Repères
disponibles » à côté du gabarit. Elle vient de la même source que le code : elle
ne peut pas annoncer un repère qui ne serait pas rempli.

---

## Éditer les attestations

Onglet **Documents** de l'espace de travail de la session :

- **Ouvrir en PDF** — toutes les attestations, **une page par admis**, en un
  seul fichier prêt à imprimer.
- **Télécharger l'ODT rempli** — le même document avant conversion, si une
  retouche est nécessaire avant impression.

Un **ajourné n'obtient jamais d'attestation de réussite** : la règle est
appliquée côté serveur, pas laissée à l'écran.

---

## Points à connaître

### Le fichier doit venir de LibreOffice

Enregistrez en **« Texte ODF (.odt) »**. Un fichier recomposé à la main sans
manifeste est refusé au téléversement : LibreOffice, lui, ne dirait rien et ne
produirait simplement aucun PDF.

### Un repère mal orthographié s'imprime tel quel

`{{niveaux}}` n'existe pas : il resterait visible sur le document. C'est
volontaire — effacer un repère inconnu donnerait une attestation amputée sans
que personne ne s'en aperçoive. Le téléversement les liste, et la génération les
signale.

### Coupure invisible d'un repère

LibreOffice découpe parfois un mot en morceaux internes (correction
orthographique, changement de langue). L'application recolle ces morceaux. En
revanche, un repère **coupé par un retour à la ligne** n'est pas reconnu :
écrivez-le d'un seul tenant, dans un seul paragraphe.

### En-têtes et pieds de page

Les repères y fonctionnent, mais ils sont remplis avec les valeurs de la
**première** personne du lot : un en-tête est commun à toutes les pages.
N'y placez que des valeurs communes — session, année — jamais un nom.

### Format de page

L'A4 paysage vient de **votre fichier**, pas de l'application : si vous changez
l'orientation dans LibreOffice, le PDF suit.

---

## Régénérer le gabarit de départ

```bash
npm run docs:attestation   # → docs/modele-attestation.odt
```

Il est produit par un script pour ne pas dériver des repères réellement acceptés,
et un test vérifie qu'il se remplit intégralement.
