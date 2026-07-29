/**
 * Lecture des dates de naissance à l'import.
 *
 * Une date mal lue ne se voit pas : elle s'imprime sur un diplôme des mois plus
 * tard. Chaque format accepté est donc figé ici, y compris les refus.
 */
import { describe, expect, it } from 'vitest';
import { parseBirthDate, parseEnrollmentRows, planCivilStatusUpdate } from '@/services/imports';

/** Date de référence : les années sur deux chiffres en dépendent. */
const NOW = new Date('2026-07-29T12:00:00Z');

/** Jour lu, en ISO, ou le genre du refus. */
function read(value: unknown): string {
  const parsed = parseBirthDate(value, NOW);
  switch (parsed.kind) {
    case 'date':
      return parsed.date.toISOString().slice(0, 10);
    case 'approximate':
      return `~${parsed.text}`;
    default:
      return parsed.kind;
  }
}

describe('parseBirthDate', () => {
  it('lit le format français, quel que soit le séparateur', () => {
    expect(read('28/07/1998')).toBe('1998-07-28');
    expect(read('28-07-1998')).toBe('1998-07-28');
    expect(read('28.07.1998')).toBe('1998-07-28');
    expect(read(' 8/7/1998 ')).toBe('1998-07-08');
  });

  it('lit le format ISO', () => {
    expect(read('1998-07-28')).toBe('1998-07-28');
    expect(read('1998-07-28T00:00:00.000Z')).toBe('1998-07-28');
  });

  /**
   * Un classeur exporté en anglais écrit mois/jour/année. Dès que le second
   * nombre dépasse 12, il ne peut pas être un mois : le doute est levé.
   */
  it('rattrape un fichier au format américain', () => {
    expect(read('7/28/1998')).toBe('1998-07-28');
    expect(read('12/13/1998')).toBe('1998-12-13');
  });

  /** Ambiguïté réelle : la convention française tranche, et est documentée. */
  it('interprète le jour en premier quand les deux nombres sont plausibles', () => {
    expect(read('03/04/1998')).toBe('1998-04-03');
  });

  it('complète une année sur deux chiffres sans la projeter dans le futur', () => {
    expect(read('28/07/98')).toBe('1998-07-28');
    expect(read('28/07/05')).toBe('2005-07-28');
    // 2027 n'est pas encore arrivé : il s'agit de 1927.
    expect(read('28/07/27')).toBe('1927-07-28');
  });

  it('accepte une cellule date Excel et son numéro de série', () => {
    expect(read(new Date(Date.UTC(1998, 6, 28)))).toBe('1998-07-28');
    expect(read(36004)).toBe('1998-07-28');
  });

  it('garde une date approximative telle qu’elle est écrite', () => {
    expect(read('1998')).toBe('~1998');
    expect(read(1998)).toBe('~1998');
    expect(read('vers 1975')).toBe('~vers 1975');
    expect(read('environ 1975')).toBe('~environ 1975');
    expect(read('حوالي 1975')).toBe('~حوالي 1975');
  });

  it('considère une cellule vide comme non renseignée', () => {
    expect(read(null)).toBe('empty');
    expect(read('')).toBe('empty');
    expect(read('   ')).toBe('empty');
  });

  it('refuse ce qui ne peut pas être une date de naissance', () => {
    expect(read('31/02/1998')).toBe('invalid'); // le 31 février n'existe pas
    expect(read('28/07/2099')).toBe('invalid'); // dans le futur
    expect(read('28/07/1850')).toBe('invalid'); // hors plage plausible
    expect(read('inconnue')).toBe('invalid');
    expect(read('28 juillet 1998')).toBe('invalid');
  });
});

describe('lecture des lignes', () => {
  it('reconnaît les intitulés d’état civil', () => {
    const { parsed } = parseEnrollmentRows([
      {
        Nom: 'BENALI',
        'Date de naissance': '28/07/1998',
        'Lieu de naissance': 'Mostaganem',
        'Lieu de naissance arabe': 'مستغانم',
      },
    ]);

    expect(parsed[0]).toMatchObject({
      birthDate: new Date(Date.UTC(1998, 6, 28)),
      birthPlace: 'Mostaganem',
      arabBirthPlace: 'مستغانم',
      approximateBirth: null,
    });
  });

  it('accepte « Né(e) le », « Né à » et les intitulés arabes', () => {
    const { parsed } = parseEnrollmentRows([
      { Nom: 'BENALI', 'Né(e) le': '28/07/1998', 'Né à': 'Oran' },
      { Nom: 'ZEROUAL', 'تاريخ الميلاد': '01/01/2000', 'مكان الميلاد': 'وهران' },
    ]);

    expect(parsed[0]).toMatchObject({ birthPlace: 'Oran' });
    expect(parsed[0]!.birthDate?.toISOString().slice(0, 10)).toBe('1998-07-28');
    expect(parsed[1]).toMatchObject({ birthPlace: 'وهران' });
  });

  /** Perdre le participant parce que sa date est fautive serait disproportionné. */
  it('conserve la ligne mais signale une date illisible', () => {
    const { parsed, issues } = parseEnrollmentRows([
      { Nom: 'BENALI', 'Date de naissance': '32/13/1998' },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ familyName: 'BENALI', birthDate: null });
    expect(issues[0]?.line).toBe(2);
    expect(issues[0]?.message).toContain('32/13/1998');
  });
});

describe('complétion d’une fiche existante', () => {
  const empty = {
    birthDate: null,
    approximateBirth: null,
    birthPlace: null,
    arabBirthPlace: null,
  };
  const row = {
    birthDate: new Date(Date.UTC(1998, 6, 28)),
    approximateBirth: null,
    birthPlace: 'Mostaganem',
    arabBirthPlace: null,
  };

  it('remplit ce qui manque', () => {
    const { data, conflicts } = planCivilStatusUpdate(empty, row);
    expect(data).toMatchObject({
      birthDate: row.birthDate,
      birthPlace: 'Mostaganem',
      birthDateIsApproximate: false,
    });
    expect(conflicts).toEqual([]);
  });

  it('ne touche à rien quand la fiche dit déjà la même chose', () => {
    const { data, conflicts } = planCivilStatusUpdate(
      { ...empty, birthDate: new Date(Date.UTC(1998, 6, 28)), birthPlace: 'Mostaganem' },
      row,
    );
    expect(data).toEqual({});
    expect(conflicts).toEqual([]);
  });

  /** Le fichier n'est pas plus fiable que la fiche : l'arbitrage est humain. */
  it('signale une divergence sans écraser la fiche', () => {
    const { data, conflicts } = planCivilStatusUpdate(
      { ...empty, birthDate: new Date(Date.UTC(1999, 0, 1)), birthPlace: 'Oran' },
      row,
    );
    expect(data).toEqual({});
    expect(conflicts).toEqual(['date de naissance', 'lieu de naissance']);
  });

  it('n’affiche pas une mention approximative par-dessus une date exacte', () => {
    const { data } = planCivilStatusUpdate(
      { ...empty, birthDate: new Date(Date.UTC(1998, 6, 28)) },
      { ...row, birthDate: null, approximateBirth: 'vers 1998' },
    );
    expect(data.approximateBirth).toBe('vers 1998');
    expect(data.birthDateIsApproximate).toBeUndefined();
  });

  it('affiche la mention approximative quand aucune date exacte n’est connue', () => {
    const { data } = planCivilStatusUpdate(empty, {
      ...row,
      birthDate: null,
      approximateBirth: 'vers 1975',
    });
    expect(data).toMatchObject({ approximateBirth: 'vers 1975', birthDateIsApproximate: true });
  });
});
