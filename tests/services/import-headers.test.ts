/**
 * Verrou sur les intitulés de colonnes documentés.
 *
 * `docs/import-excel.md` promet à l'utilisateur qu'un certain nombre d'en-têtes
 * sont acceptés. Sans ce test, la documentation pourrait affirmer sans risque ce
 * que le code ne fait pas — c'est exactement l'erreur qui a été commise avec
 * « N° », annoncé comme reconnu alors qu'il ne l'était pas.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  COLUMNS,
  normalizeHeader,
  parseEnrollmentRows,
  parseParticipantType,
  parseTabular,
} from '@/services/imports';

type Field = keyof typeof COLUMNS;

/** Champ auquel un en-tête est rattaché, ou `null` s'il n'est pas reconnu. */
function fieldFor(header: string): Field | null {
  const normalized = normalizeHeader(header);
  const match = Object.entries(COLUMNS).find(([, aliases]) =>
    (aliases as readonly string[]).includes(normalized),
  );
  return (match?.[0] as Field | undefined) ?? null;
}

/** Chaque entrée reprend un intitulé annoncé dans la documentation. */
const DOCUMENTED: Array<[string, Field]> = [
  // Identité
  ['Nom', 'familyName'],
  ['NOM', 'familyName'],
  ['Nom de famille', 'familyName'],
  ['Family name', 'familyName'],
  ['اللقب', 'familyName'],
  ['Prénom', 'firstName'],
  ['prenom', 'firstName'],
  ['Prénoms', 'firstName'],
  ['First name', 'firstName'],
  ['الاسم', 'firstName'],
  ['Nom arabe', 'arabName'],
  ['Nom ar', 'arabName'],
  ['Prénom arabe', 'arabFirstName'],
  ['Prénom ar', 'arabFirstName'],

  // État civil
  ['Date de naissance', 'birthDate'],
  ['Date naissance', 'birthDate'],
  ['Naissance', 'birthDate'],
  ['Né le', 'birthDate'],
  ['Né(e) le', 'birthDate'],
  ['Birth date', 'birthDate'],
  ['تاريخ الميلاد', 'birthDate'],
  ['Lieu de naissance', 'birthPlace'],
  ['Né à', 'birthPlace'],
  ['Née à', 'birthPlace'],
  ['Birth place', 'birthPlace'],
  ['مكان الميلاد', 'birthPlace'],
  ['Lieu de naissance arabe', 'arabBirthPlace'],
  ['مكان الميلاد بالعربية', 'arabBirthPlace'],

  // Coordonnées et rattachement
  ['Type', 'type'],
  ['Catégorie', 'type'],
  ['Téléphone', 'phone'],
  ['Tél', 'phone'],
  ['Phone', 'phone'],
  ['Email', 'email'],
  ['Courriel', 'email'],

  // Matricule, y compris l'abréviation « N° »
  ['Matricule', 'registrationNumber'],
  ['Numéro', 'registrationNumber'],
  ['No', 'registrationNumber'],
  ['N°', 'registrationNumber'],
  ['Registration number', 'registrationNumber'],
  ['رقم التسجيل', 'registrationNumber'],

  // Compétences
  ['E.O', 'oralExpression'],
  ['EO', 'oralExpression'],
  ['Expression orale', 'oralExpression'],
  ['E.E', 'writtenExpression'],
  ['EE', 'writtenExpression'],
  ['Expression écrite', 'writtenExpression'],
  ['C.O', 'oralComprehension'],
  ['CO', 'oralComprehension'],
  ['Compréhension orale', 'oralComprehension'],
  ['C.E', 'writtenComprehension'],
  ['CE', 'writtenComprehension'],
  ['Compréhension écrite', 'writtenComprehension'],
];

describe('en-têtes documentés', () => {
  it.each(DOCUMENTED)('« %s » est rattaché à %s', (header, field) => {
    expect(fieldFor(header)).toBe(field);
  });

  it('tolère la ponctuation et les espaces superflus', () => {
    expect(fieldFor('  Prénom :  ')).toBe('firstName');
    expect(fieldFor('Téléphone')).toBe('phone');
  });

  /**
   * Un « N » seul est presque toujours un numéro de ligne : le confondre avec un
   * matricule ferait chercher des correspondances inexistantes.
   */
  it('ne prend pas un « N » seul pour un matricule', () => {
    expect(fieldFor('N')).toBeNull();
    expect(fieldFor('#')).toBeNull();
  });

  it('reconnaît un enseignant quelle que soit l’écriture', () => {
    for (const value of ['Enseignant', 'ENS', 'prof', 'Professeur', 'أستاذ', 'استاذ']) {
      expect(parseParticipantType(value), value).toBe('TEACHER');
    }
  });

  it('considère tout le reste comme étudiant', () => {
    for (const value of ['Étudiant', 'etudiant', 'externe', '', null]) {
      expect(parseParticipantType(value), String(value)).toBe('STUDENT');
    }
  });
});

/**
 * Le modèle distribué aux utilisateurs est relu par le code qui l'importera :
 * s'il cessait d'être compris — parce que le format a bougé sans que
 * `npm run docs:template` soit relancé — l'échec est ici, pas chez eux.
 */
describe('modèle docs/modele-import-ceil.xlsx', () => {
  const file = readFileSync(resolve(process.cwd(), 'docs/modele-import-ceil.xlsx'));
  const workbook = XLSX.read(file, { type: 'buffer' });

  it('se lit comme un fichier d’inscrits valide', () => {
    const { parsed, issues } = parseEnrollmentRows(parseTabular(file));

    expect(issues).toEqual([]);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({
      familyName: 'BENALI',
      firstName: 'Amina',
      birthPlace: 'Mostaganem',
      type: 'STUDENT',
    });
    expect(parsed[0]!.birthDate?.toISOString().slice(0, 10)).toBe('1998-07-28');
    expect(parsed[1]).toMatchObject({ type: 'TEACHER', approximateBirth: 'vers 1975' });
    // Réinscription : le matricule seul, sans nom.
    expect(parsed[2]).toMatchObject({ familyName: null, registrationNumber: 'PART-ETU-2026-0001' });
  });

  it('n’utilise que des intitulés reconnus, sur les trois feuilles', () => {
    expect(workbook.SheetNames).toEqual(['Inscrits', 'Positionnement', 'Notes']);

    for (const name of workbook.SheetNames) {
      const [headers = []] = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name]!, {
        header: 1,
      });
      for (const header of headers) {
        expect(fieldFor(header), `${name} / ${header}`).not.toBeNull();
      }
    }
  });
});
