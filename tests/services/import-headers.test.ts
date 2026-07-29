/**
 * Verrou sur les intitulés de colonnes documentés.
 *
 * `docs/import-excel.md` promet à l'utilisateur qu'un certain nombre d'en-têtes
 * sont acceptés. Sans ce test, la documentation pourrait affirmer sans risque ce
 * que le code ne fait pas — c'est exactement l'erreur qui a été commise avec
 * « N° », annoncé comme reconnu alors qu'il ne l'était pas.
 */
import { describe, expect, it } from 'vitest';
import { COLUMNS, normalizeHeader, parseParticipantType } from '@/services/imports';

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
