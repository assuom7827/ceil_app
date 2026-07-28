import { beforeEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { enroll } from '@/services/enrollment';
import { lockSession } from '@/services/locking';
import {
  importDeliberationScores,
  importEnrollments,
  normalizeHeader,
  parseEnrollmentRows,
  parseParticipantType,
  parseTabular,
  pick,
  toNumber,
  type RawRow,
} from '@/services/imports';
import { computeAdmission } from '@/services/deliberation';
import {
  createParticipants,
  createSession,
  createTraining,
  databaseAvailable,
  prisma,
  resetDatabase,
} from './helpers';

const hasDb = await databaseAvailable();

/** Construit un vrai classeur Excel en mémoire, comme celui d'un utilisateur. */
function buildWorkbook(rows: Array<Record<string, string | number>>): Uint8Array {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Feuille1');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

// ---------------------------------------------------------------------------
// Parsing — pur, sans base
// ---------------------------------------------------------------------------

describe('parsing des fichiers', () => {
  it('normalise les en-têtes accentués et ponctués', () => {
    expect(normalizeHeader('Prénom')).toBe('prenom');
    expect(normalizeHeader('  E.E  ')).toBe('e e');
    expect(normalizeHeader('Compréhension Écrite')).toBe('comprehension ecrite');
  });

  it('préserve les en-têtes arabes', () => {
    expect(normalizeHeader('اللقب')).toBe('اللقب');
  });

  it('retient le premier alias renseigné', () => {
    const row: RawRow = { nom: '', 'nom de famille': 'BENALI' };
    expect(pick(row, ['nom', 'nom de famille'])).toBe('BENALI');
    expect(pick(row, ['inexistant'])).toBeNull();
  });

  it('accepte la virgule décimale', () => {
    expect(toNumber('12,5')).toBe(12.5);
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber(null)).toBeNull();
  });

  it('reconnaît le type enseignant en français comme en arabe', () => {
    expect(parseParticipantType('Enseignant')).toBe('TEACHER');
    expect(parseParticipantType('ENS')).toBe('TEACHER');
    expect(parseParticipantType('أستاذ')).toBe('TEACHER');
    expect(parseParticipantType('Étudiant')).toBe('STUDENT');
    expect(parseParticipantType(null)).toBe('STUDENT');
  });

  it('lit un vrai classeur Excel', () => {
    const buffer = buildWorkbook([{ Nom: 'BENALI', Prénom: 'Amina', Téléphone: '0550' }]);
    const rows = parseTabular(buffer);
    expect(rows).toHaveLength(1);
    expect(parseEnrollmentRows(rows).parsed[0]).toMatchObject({
      familyName: 'BENALI',
      firstName: 'Amina',
      phone: '0550',
    });
  });

  it('lit un CSV', () => {
    const rows = parseTabular('Nom,Prenom\nBENALI,Amina\n');
    expect(parseEnrollmentRows(rows).parsed[0]).toMatchObject({ familyName: 'BENALI' });
  });

  it('ignore les lignes vides mais signale les lignes sans nom', () => {
    const rows: RawRow[] = [
      { Nom: 'BENALI', Prenom: 'Amina' },
      { Nom: '', Prenom: '' },
      { Nom: '', Prenom: '', Telephone: '0550' },
    ];
    const { parsed, issues } = parseEnrollmentRows(rows);

    expect(parsed).toHaveLength(1);
    expect(issues).toHaveLength(1);
    // Ligne 4 du fichier : en-tête + 3e ligne de données.
    expect(issues[0]).toMatchObject({ line: 4 });
  });
});

// ---------------------------------------------------------------------------
// Application en base
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)('import d’inscriptions', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('crée les participants absents puis les inscrit', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);

    const rows = parseTabular(
      buildWorkbook([
        { Nom: 'BENALI', Prénom: 'Amina', Type: 'Étudiant' },
        { Nom: 'ZEROUAL', Prénom: 'Karim', Type: 'Enseignant' },
      ]),
    );

    const report = await importEnrollments(prisma, session.id, rows);

    expect(report).toMatchObject({
      rows: 2,
      participantsCreated: 2,
      participantsMatched: 0,
      enrolled: 2,
      skipped: 0,
    });

    const teacher = await prisma.participant.findFirstOrThrow({ where: { familyName: 'ZEROUAL' } });
    expect(teacher.type).toBe('TEACHER');
    expect(teacher.registrationNumber).toMatch(/^PART-ENS-/);
  });

  it('rapproche un participant existant par son matricule', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [existing] = await createParticipants(1);

    const rows = parseTabular(
      buildWorkbook([{ Matricule: existing!.registrationNumber, Nom: 'PEU IMPORTE' }]),
    );
    const report = await importEnrollments(prisma, session.id, rows);

    expect(report).toMatchObject({ participantsCreated: 0, participantsMatched: 1, enrolled: 1 });
    expect(await prisma.participant.count()).toBe(1);
  });

  it('ignore un participant déjà inscrit sans le dupliquer', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [existing] = await createParticipants(1);
    await enroll(prisma, session.id, [existing!.id]);

    const rows = parseTabular(buildWorkbook([{ Matricule: existing!.registrationNumber }]));
    expect(await importEnrollments(prisma, session.id, rows)).toMatchObject({
      enrolled: 0,
      skipped: 1,
    });
  });

  it('ne crée aucun participant si la session est verrouillée (409)', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    await lockSession(prisma, session.id);

    const rows = parseTabular(buildWorkbook([{ Nom: 'BENALI' }]));
    await expect(importEnrollments(prisma, session.id, rows)).rejects.toMatchObject({
      code: 'LOCKED',
      status: 409,
    });
    expect(await prisma.participant.count()).toBe(0);
  });
});

describe.skipIf(!hasDb)('import des notes de délibération', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function setup() {
    const { training } = await createTraining();
    const session = await createSession(training.id, { admissionThreshold: 50 });
    const participants = await createParticipants(2);
    await enroll(
      prisma,
      session.id,
      participants.map((p) => p.id),
    );
    const enrollments = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id },
      orderBy: { registrationNumber: 'asc' },
    });
    return { session, participants, enrollments };
  }

  it('importe les 4 notes et met à jour l’admission', async () => {
    const { session, enrollments } = await setup();

    const rows = parseTabular(
      buildWorkbook([
        {
          Matricule: enrollments[0]!.registrationNumber!,
          'E.O': 15,
          'E.E': 15,
          'C.O': 15,
          'C.E': 15,
        },
        { Matricule: enrollments[1]!.registrationNumber!, 'E.O': 5, 'E.E': 5, 'C.O': 5, 'C.E': 5 },
      ]),
    );

    expect(await importDeliberationScores(prisma, session.id, rows)).toMatchObject({
      rows: 2,
      updated: 2,
      unmatched: [],
    });
    expect(await computeAdmission(prisma, session.id)).toMatchObject({ admitted: 1, refused: 1 });
  });

  it('accepte aussi bien le matricule d’inscription que celui du participant', async () => {
    const { session, participants } = await setup();

    const rows = parseTabular(
      buildWorkbook([{ Matricule: participants[0]!.registrationNumber, 'E.O': 60 }]),
    );
    expect(await importDeliberationScores(prisma, session.id, rows)).toMatchObject({ updated: 1 });
  });

  it('signale les matricules sans correspondance', async () => {
    const { session } = await setup();
    const rows = parseTabular(buildWorkbook([{ Matricule: 'INCONNU-9999', 'E.O': 12 }]));

    expect(await importDeliberationScores(prisma, session.id, rows)).toMatchObject({
      updated: 0,
      unmatched: ['INCONNU-9999'],
    });
  });

  it('signale les lignes inexploitables sans bloquer les autres', async () => {
    const { session, enrollments } = await setup();
    const rows = parseTabular(
      buildWorkbook([
        { Matricule: enrollments[0]!.registrationNumber!, 'E.O': 12 },
        { Matricule: enrollments[1]!.registrationNumber!, 'E.O': '' }, // aucune note
      ]),
    );

    const report = await importDeliberationScores(prisma, session.id, rows);
    expect(report.updated).toBe(1);
    expect(report.issues).toHaveLength(1);
  });

  it('accepte les notes en virgule décimale', async () => {
    const { session, enrollments } = await setup();
    const rows = parseTabular(
      buildWorkbook([{ Matricule: enrollments[0]!.registrationNumber!, 'E.O': '12,5' }]),
    );

    await importDeliberationScores(prisma, session.id, rows);
    const entry = await prisma.deliberationEntry.findFirstOrThrow();
    expect(entry.oralExpression).toBe(12.5);
  });

  it('refuse l’import dans une session verrouillée (409)', async () => {
    const { session } = await setup();
    await lockSession(prisma, session.id);

    await expect(importDeliberationScores(prisma, session.id, [])).rejects.toMatchObject({
      code: 'LOCKED',
      status: 409,
    });
  });
});
