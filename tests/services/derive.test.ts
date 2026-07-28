import { describe, expect, it } from 'vitest';
import {
  ARABIC_MONTHS,
  arabicMonth,
  arabicMonthOfDate,
  deriveAdmissionStatus,
  deriveArabicMonthTo,
  deriveBirthDisplay,
  deriveEntryTotal,
  deriveEntryTotalAndStatus,
  deriveParticipantArabicFullName,
  deriveParticipantFullName,
  derivePositioning,
  derivePositioningTotal,
  deriveSessionTitle,
  deriveTrainingFullName,
  deriveYears,
  formatEnrollmentRegistrationNumber,
  formatParticipantRegistrationNumber,
  formatReceiptNumber,
  isLocked,
  resolveLevelForPoints,
  sumScores,
  type LevelIntervalInput,
} from '@/services/derive';

/** Barème CECRL du seed : intervalles contigus et semi-ouverts sur 0..100. */
const LEVELS: LevelIntervalInput[] = [
  { id: 'a0', name: 'A0', sequence: 1, minimumPoints: 0, maximumPoints: 10 },
  { id: 'a11', name: 'A1.1', sequence: 2, minimumPoints: 10, maximumPoints: 20 },
  { id: 'a12', name: 'A1.2', sequence: 3, minimumPoints: 20, maximumPoints: 30 },
  { id: 'a21', name: 'A2.1', sequence: 4, minimumPoints: 30, maximumPoints: 40 },
  { id: 'a22', name: 'A2.2', sequence: 5, minimumPoints: 40, maximumPoints: 50 },
  { id: 'b11', name: 'B1.1', sequence: 6, minimumPoints: 50, maximumPoints: 60 },
  { id: 'b12', name: 'B1.2', sequence: 7, minimumPoints: 60, maximumPoints: 70 },
  { id: 'b21', name: 'B2.1', sequence: 8, minimumPoints: 70, maximumPoints: 80 },
  { id: 'b22', name: 'B2.2', sequence: 9, minimumPoints: 80, maximumPoints: 90 },
  { id: 'c1', name: 'C1', sequence: 10, minimumPoints: 90, maximumPoints: 95 },
  { id: 'c2', name: 'C2', sequence: 11, minimumPoints: 95, maximumPoints: 101 },
];

describe('sumScores', () => {
  it('distingue une ligne vierge (null) d’un total nul (0)', () => {
    expect(sumScores([null, undefined])).toBeNull();
    expect(sumScores([0, null])).toBe(0);
  });

  it('additionne uniquement les valeurs renseignées', () => {
    expect(sumScores([10, null, 5, undefined])).toBe(15);
  });

  it('ignore les valeurs non finies', () => {
    expect(sumScores([Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
    expect(sumScores([Number.NaN, 7])).toBe(7);
  });
});

describe('noms et titres dérivés', () => {
  it('compose le nom complet du participant', () => {
    expect(deriveParticipantFullName({ familyName: 'BENALI', firstName: 'Amina' })).toBe(
      'BENALI Amina',
    );
  });

  it('tolère les champs manquants ou espacés', () => {
    expect(deriveParticipantFullName({ familyName: '  BENALI  ', firstName: null })).toBe('BENALI');
    expect(deriveParticipantFullName({})).toBe('');
  });

  it('compose le nom arabe', () => {
    expect(deriveParticipantArabicFullName({ arabName: 'بن علي', arabFirstName: 'أمينة' })).toBe(
      'بن علي أمينة',
    );
  });

  it('compose le nom de formation bilingue', () => {
    expect(deriveTrainingFullName({ frName: 'Anglais', arName: 'الإنجليزية' })).toBe(
      'Anglais (الإنجليزية)',
    );
    expect(deriveTrainingFullName({ frName: 'Anglais', arName: null })).toBe('Anglais');
  });

  it('compose le titre de session à partir des relations', () => {
    expect(
      deriveSessionTitle({
        training: { frName: 'Anglais' },
        trainingLevel: { name: 'B1.1' },
        academicYear: '2025-2026',
      }),
    ).toBe('Anglais B1.1 2025-2026');
  });

  it('omet les segments absents du titre de session', () => {
    expect(deriveSessionTitle({ training: { frName: 'Turc' }, academicYear: '2025-2026' })).toBe(
      'Turc 2025-2026',
    );
    expect(deriveSessionTitle({})).toBe('');
  });
});

describe('dates dérivées', () => {
  it('couvre les 12 mois arabes', () => {
    expect(Object.keys(ARABIC_MONTHS)).toHaveLength(12);
    expect(arabicMonth(1)).toBe('جانفي');
    expect(arabicMonth(12)).toBe('ديسمبر');
  });

  it('rejette un numéro de mois hors intervalle', () => {
    expect(arabicMonth(0)).toBeNull();
    expect(arabicMonth(13)).toBeNull();
    expect(arabicMonth(null)).toBeNull();
  });

  it('déduit le mois arabe d’une date', () => {
    expect(arabicMonthOfDate(new Date(2026, 5, 15))).toBe('جوان');
    expect(arabicMonthOfDate('pas-une-date')).toBeNull();
  });

  it('expose le mois de fin de session pour le diplôme', () => {
    expect(deriveArabicMonthTo({ dateTo: new Date(2026, 6, 3) })).toBe('جويلية');
    expect(deriveArabicMonthTo({})).toBeNull();
  });

  it('déduit les années de début et de fin', () => {
    expect(deriveYears({ dateFrom: new Date(2025, 9, 1), dateTo: new Date(2026, 5, 30) })).toEqual({
      yearFrom: 2025,
      yearTo: 2026,
    });
    expect(deriveYears({})).toEqual({ yearFrom: null, yearTo: null });
  });
});

describe('positionnement', () => {
  it('additionne E.E et C.E', () => {
    expect(derivePositioningTotal({ writtenExpression: 28, writtenComprehension: 27 })).toBe(55);
  });

  it('reste null tant qu’aucune note n’est saisie', () => {
    expect(derivePositioningTotal({})).toBeNull();
  });

  it('applique un intervalle SEMI-OUVERT [min, max[', () => {
    // 50 appartient à B1.1 [50,60[ et non à A2.2 [40,50[.
    expect(resolveLevelForPoints(LEVELS, 50)?.name).toBe('B1.1');
    expect(resolveLevelForPoints(LEVELS, 49)?.name).toBe('A2.2');
    expect(resolveLevelForPoints(LEVELS, 0)?.name).toBe('A0');
    expect(resolveLevelForPoints(LEVELS, 100)?.name).toBe('C2');
  });

  it('ne résout aucun niveau hors barème ou sans note', () => {
    expect(resolveLevelForPoints(LEVELS, 101)).toBeNull();
    expect(resolveLevelForPoints(LEVELS, -1)).toBeNull();
    expect(resolveLevelForPoints(LEVELS, null)).toBeNull();
  });

  it('ignore les niveaux désactivés', () => {
    const withDisabled = LEVELS.map((level) =>
      level.name === 'B1.1' ? { ...level, disabled: true } : level,
    );
    expect(resolveLevelForPoints(withDisabled, 55)).toBeNull();
  });

  it('tranche un chevauchement par la séquence la plus faible', () => {
    const overlapping: LevelIntervalInput[] = [
      { id: 'x', name: 'X', sequence: 2, minimumPoints: 0, maximumPoints: 100 },
      { id: 'y', name: 'Y', sequence: 1, minimumPoints: 0, maximumPoints: 100 },
    ];
    expect(resolveLevelForPoints(overlapping, 42)?.name).toBe('Y');
  });

  it('calcule total et niveau en une passe', () => {
    expect(
      derivePositioning({ writtenExpression: 30, writtenComprehension: 35 }, LEVELS).resolvedLevel
        ?.name,
    ).toBe('B1.2');
  });
});

describe('délibération', () => {
  const full = {
    oralExpression: 12,
    writtenExpression: 14,
    oralComprehension: 13,
    writtenComprehension: 15,
  };

  it('additionne les 4 compétences', () => {
    expect(deriveEntryTotal(full)).toBe(54);
  });

  it('admet à partir du seuil inclus', () => {
    expect(deriveAdmissionStatus(50, 50)).toBe('ADMITTED');
    expect(deriveAdmissionStatus(49.99, 50)).toBe('REFUSED');
  });

  it('respecte un seuil propre à la session', () => {
    expect(deriveEntryTotalAndStatus(full, 50).status).toBe('ADMITTED');
    expect(deriveEntryTotalAndStatus(full, 60).status).toBe('REFUSED');
  });

  it('ne délibère pas une ligne vierge', () => {
    expect(deriveEntryTotalAndStatus({}, 50)).toEqual({ total: null, status: null });
  });

  it('délibère dès qu’une seule note est saisie', () => {
    expect(deriveEntryTotalAndStatus({ oralExpression: 10 }, 50)).toEqual({
      total: 10,
      status: 'REFUSED',
    });
  });
});

describe('verrouillage', () => {
  it('ne considère verrouillé que l’état LOCKED', () => {
    expect(isLocked('LOCKED')).toBe(true);
    expect(isLocked('OPEN')).toBe(false);
    expect(isLocked(null)).toBe(false);
  });
});

describe('formats de matricules', () => {
  it('distingue étudiant et enseignant', () => {
    expect(formatParticipantRegistrationNumber('STUDENT', 2026, 7)).toBe('PART-ETU-2026-0007');
    expect(formatParticipantRegistrationNumber('TEACHER', 2026, 7)).toBe('PART-ENS-2026-0007');
  });

  it('ne tronque pas au-delà de la largeur de padding', () => {
    expect(formatParticipantRegistrationNumber('STUDENT', 2026, 123456)).toBe(
      'PART-ETU-2026-123456',
    );
  });

  it('construit le matricule d’inscription sur le préfixe de session', () => {
    expect(formatEnrollmentRegistrationNumber('CEIL-ANG-B11', 3)).toBe('CEIL-ANG-B11-0003');
  });

  it('retombe sur un préfixe neutre si la session n’en définit pas', () => {
    expect(formatEnrollmentRegistrationNumber(null, 3)).toBe('INS-0003');
    expect(formatEnrollmentRegistrationNumber('   ', 3)).toBe('INS-0003');
  });

  it('numérote les reçus par année', () => {
    expect(formatReceiptNumber(2026, 42)).toBe('PAY-2026-0042');
  });
});

describe('affichage de la naissance', () => {
  it('formate la date exacte', () => {
    expect(deriveBirthDisplay({ birthDate: new Date(1998, 2, 5) })).toBe('05/03/1998');
  });

  it('privilégie la mention approximative quand elle s’applique', () => {
    expect(
      deriveBirthDisplay({
        birthDate: new Date(1998, 2, 5),
        birthDateIsApproximate: true,
        approximateBirth: 'vers 1998',
      }),
    ).toBe('vers 1998');
  });

  it('retourne null sans information exploitable', () => {
    expect(deriveBirthDisplay({})).toBeNull();
    expect(deriveBirthDisplay({ birthDateIsApproximate: true })).toBeNull();
  });
});
