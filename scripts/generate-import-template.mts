/**
 * Génère le modèle d'import distribué dans `docs/`.
 *
 * Les intitulés ci-dessous sont ceux documentés dans `docs/import-excel.md` ;
 * ils sont repris des alias acceptés par `services/imports.ts`. Générer le
 * fichier depuis un script plutôt que de le maintenir à la main évite qu'il
 * dérive du format réellement accepté.
 *
 *   npm run docs:template
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as XLSX from 'xlsx';

const OUTPUT = resolve(process.cwd(), 'docs/modele-import-ceil.xlsx');

/** Une feuille par import ; l'application n'en lit qu'une à la fois. */
const INSCRITS = [
  {
    Matricule: '',
    Nom: 'BENALI',
    Prénom: 'Amina',
    'Nom arabe': 'بن علي',
    'Prénom arabe': 'أمينة',
    'Date de naissance': '28/07/1998',
    'Lieu de naissance': 'Mostaganem',
    'Lieu de naissance arabe': 'مستغانم',
    Type: 'Étudiant',
    Téléphone: '0550112233',
    Email: 'amina.benali@example.dz',
  },
  {
    Matricule: '',
    Nom: 'ZEROUAL',
    Prénom: 'Karim',
    'Nom arabe': '',
    'Prénom arabe': '',
    // État civil ancien : la mention approximative est conservée telle quelle.
    'Date de naissance': 'vers 1975',
    'Lieu de naissance': 'Oran',
    'Lieu de naissance arabe': '',
    Type: 'Enseignant',
    Téléphone: '0661445566',
    Email: '',
  },
  {
    // Participant déjà connu : le matricule seul suffit, il sera rapproché.
    Matricule: 'PART-ETU-2026-0001',
    Nom: '',
    Prénom: '',
    'Nom arabe': '',
    'Prénom arabe': '',
    'Date de naissance': '',
    'Lieu de naissance': '',
    'Lieu de naissance arabe': '',
    Type: '',
    Téléphone: '',
    Email: '',
  },
];

const POSITIONNEMENT = [
  { Matricule: 'CEIL-ANG-0001', 'E.E': 28, 'C.E': 27 },
  { Matricule: 'CEIL-ANG-0002', 'E.E': 12, 'C.E': 15 },
];

const NOTES = [
  { Matricule: 'CEIL-ANG-0001', 'E.O': 15, 'E.E': 14, 'C.O': 13, 'C.E': 16 },
  { Matricule: 'CEIL-ANG-0002', 'E.O': 8, 'E.E': 9, 'C.O': 7, 'C.E': '12,5' },
];

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(INSCRITS), 'Inscrits');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(POSITIONNEMENT), 'Positionnement');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(NOTES), 'Notes');

mkdirSync(dirname(OUTPUT), { recursive: true });
XLSX.writeFile(workbook, OUTPUT);

console.log(`Modèle d'import écrit dans ${OUTPUT}`);
