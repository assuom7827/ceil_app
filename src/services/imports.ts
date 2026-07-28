/**
 * Imports Excel / CSV.
 *
 * Le parsing (pur, testable sans base) est séparé de l'application en base.
 * Chaque import renvoie un RAPPORT détaillé : rien n'est deviné silencieusement,
 * les lignes en erreur sont listées avec leur numéro pour être corrigées.
 */
import * as XLSX from 'xlsx';
import type { Db } from './db';
import { withTransaction } from './db';
import { validationError } from './errors';
import { assertPositioningTestWritable, assertSessionWritable } from './locking';
import { createParticipant, enroll } from './enrollment';
import type { ParticipantTypeLike } from './derive';

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export type RawRow = Record<string, unknown>;

/**
 * Normalise un en-tête ou un libellé : minuscules, sans accent latin ni
 * diacritique arabe, ponctuation réduite à des espaces.
 *
 * Les diacritiques arabes (hamza, fatha, shadda…) sont facultatifs à la saisie :
 * sans cette normalisation, « أستاذ » et « استاذ » ne se rapprocheraient pas.
 */
export function normalizeHeader(header: string): string {
  return (
    header
      .normalize('NFD')
      // Diacritiques latins (U+0300–U+036F) et arabes (U+064B–U+065F, U+0670).
      .replace(/[̀-ًͯ-ٰٟ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
      .trim()
  );
}

/** Lit un classeur Excel ou un CSV et renvoie les lignes de la 1re feuille. */
export function parseTabular(input: ArrayBuffer | Uint8Array | string): RawRow[] {
  const workbook =
    typeof input === 'string'
      ? XLSX.read(input, { type: 'string', raw: false })
      : XLSX.read(input, { type: 'array' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw validationError('Le fichier ne contient aucune feuille.');
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw validationError('Feuille de calcul illisible.');
  }

  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: false });
}

/** Réindexe une ligne sur ses en-têtes normalisés. */
export function normalizeRow(row: RawRow): RawRow {
  const normalized: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }
  return normalized;
}

/** Première valeur non vide parmi les alias de colonne acceptés. */
export function pick(row: RawRow, aliases: readonly string[]): string | null {
  for (const alias of aliases) {
    const value = row[alias];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return null;
}

/** Vrai si aucune cellule de la ligne ne porte de valeur. */
export function isBlankRow(row: RawRow): boolean {
  return Object.values(row).every(
    (value) => value === null || value === undefined || String(value).trim().length === 0,
  );
}

/** Convertit en nombre en acceptant la virgule décimale. */
export function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export const COLUMNS = {
  familyName: ['nom', 'nom de famille', 'family name', 'اللقب'],
  firstName: ['prenom', 'prenoms', 'first name', 'الاسم'],
  arabName: ['nom arabe', 'اللقب بالعربية', 'nom ar'],
  arabFirstName: ['prenom arabe', 'الاسم بالعربية', 'prenom ar'],
  type: ['type', 'categorie', 'الصفة'],
  phone: ['telephone', 'tel', 'phone', 'الهاتف'],
  email: ['email', 'mail', 'courriel'],
  registrationNumber: ['matricule', 'numero', 'no', 'registration number', 'رقم التسجيل'],
  oralExpression: ['eo', 'e o', 'expression orale', 'التعبير الشفوي'],
  writtenExpression: ['ee', 'e e', 'expression ecrite', 'التعبير الكتابي'],
  oralComprehension: ['co', 'c o', 'comprehension orale', 'الفهم الشفوي'],
  writtenComprehension: ['ce', 'c e', 'comprehension ecrite', 'الفهم الكتابي'],
} as const;

/** `type` accepte les libellés français comme les codes internes. */
export function parseParticipantType(value: string | null): ParticipantTypeLike {
  if (!value) return 'STUDENT';
  const normalized = normalizeHeader(value);
  const teacherWords = ['teacher', 'enseignant', 'ens', 'prof', 'professeur', 'استاذ'];
  return teacherWords.includes(normalized) ? 'TEACHER' : 'STUDENT';
}

export interface ImportIssue {
  /** Numéro de ligne dans le fichier, en-tête comprise (comme dans Excel). */
  line: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Import d'inscriptions
// ---------------------------------------------------------------------------

export interface ParsedEnrollmentRow {
  line: number;
  familyName: string | null;
  firstName: string | null;
  arabName: string | null;
  arabFirstName: string | null;
  type: ParticipantTypeLike;
  phone: string | null;
  email: string | null;
  registrationNumber: string | null;
}

export function parseEnrollmentRows(rows: RawRow[]): {
  parsed: ParsedEnrollmentRow[];
  issues: ImportIssue[];
} {
  const parsed: ParsedEnrollmentRow[] = [];
  const issues: ImportIssue[] = [];

  rows.forEach((raw, index) => {
    const line = index + 2; // +1 pour l'en-tête, +1 pour partir de 1
    const row = normalizeRow(raw);

    const familyName = pick(row, COLUMNS.familyName);
    const firstName = pick(row, COLUMNS.firstName);
    const arabName = pick(row, COLUMNS.arabName);
    const registrationNumber = pick(row, COLUMNS.registrationNumber);

    // Une ligne entièrement vide est ignorée sans bruit. En revanche une ligne
    // qui porte des données mais aucun identifiant est SIGNALÉE : la passer
    // sous silence ferait disparaître un participant sans que personne ne le
    // remarque.
    if (isBlankRow(row)) return;

    if (!familyName && !firstName && !arabName && !registrationNumber) {
      issues.push({ line, message: 'Ligne sans nom ni matricule exploitable.' });
      return;
    }

    parsed.push({
      line,
      familyName,
      firstName,
      arabName,
      arabFirstName: pick(row, COLUMNS.arabFirstName),
      type: parseParticipantType(pick(row, COLUMNS.type)),
      phone: pick(row, COLUMNS.phone),
      email: pick(row, COLUMNS.email),
      registrationNumber,
    });
  });

  return { parsed, issues };
}

export interface ImportEnrollmentsReport {
  /** Lignes exploitables du fichier. */
  rows: number;
  participantsCreated: number;
  participantsMatched: number;
  enrolled: number;
  /** Déjà inscrits : ignorés sans erreur. */
  skipped: number;
  issues: ImportIssue[];
}

/**
 * Crée les participants absents puis les inscrit à la session, en une opération.
 *
 * Un participant est rapproché par son matricule lorsque le fichier en fournit
 * un ; sinon il est créé. On ne rapproche jamais sur le seul nom : deux
 * homonymes sont deux personnes.
 */
export async function importEnrollments(
  db: Db,
  trainingSessionId: string,
  rows: RawRow[],
): Promise<ImportEnrollmentsReport> {
  await assertSessionWritable(db, trainingSessionId);

  const { parsed, issues } = parseEnrollmentRows(rows);
  const report: ImportEnrollmentsReport = {
    rows: parsed.length,
    participantsCreated: 0,
    participantsMatched: 0,
    enrolled: 0,
    skipped: 0,
    issues: [...issues],
  };

  if (parsed.length === 0) return report;

  return withTransaction(db, async (tx) => {
    const participantIds: string[] = [];

    for (const row of parsed) {
      if (row.registrationNumber) {
        const existing = await tx.participant.findUnique({
          where: { registrationNumber: row.registrationNumber },
          select: { id: true },
        });
        if (existing) {
          participantIds.push(existing.id);
          report.participantsMatched += 1;
          continue;
        }
      }

      if (!row.familyName && !row.firstName && !row.arabName) {
        // Ligne identifiée par un matricule qui ne correspond à personne :
        // impossible de créer le participant faute de nom.
        report.issues.push({
          line: row.line,
          message: `Matricule ${row.registrationNumber} inconnu et ligne sans nom : impossible de créer le participant.`,
        });
        continue;
      }

      const created = await createParticipant(tx, {
        familyName: row.familyName,
        firstName: row.firstName,
        arabName: row.arabName,
        arabFirstName: row.arabFirstName,
        type: row.type,
        phone: row.phone,
        email: row.email,
      });
      participantIds.push(created.id);
      report.participantsCreated += 1;
    }

    const result = await enroll(tx, trainingSessionId, participantIds);
    report.enrolled = result.created;
    report.skipped = result.skipped;

    return report;
  });
}

// ---------------------------------------------------------------------------
// Import de notes
// ---------------------------------------------------------------------------

export interface ImportScoresReport {
  rows: number;
  updated: number;
  /** Matricules du fichier sans correspondance dans la session ou le test. */
  unmatched: string[];
  issues: ImportIssue[];
}

interface ScoreRow<T> {
  line: number;
  registrationNumber: string;
  values: T;
}

/**
 * Lit les lignes « matricule → notes ». Le matricule accepté est celui de
 * l'inscription comme celui du participant.
 */
function parseScoreRows<T>(
  rows: RawRow[],
  readValues: (row: RawRow) => T,
  hasAnyValue: (values: T) => boolean,
): { parsed: ScoreRow<T>[]; issues: ImportIssue[] } {
  const parsed: ScoreRow<T>[] = [];
  const issues: ImportIssue[] = [];

  rows.forEach((raw, index) => {
    const line = index + 2;
    const row = normalizeRow(raw);
    const registrationNumber = pick(row, COLUMNS.registrationNumber);
    const values = readValues(row);

    if (!registrationNumber) {
      if (hasAnyValue(values)) {
        issues.push({ line, message: 'Notes présentes mais matricule absent.' });
      }
      return;
    }
    if (!hasAnyValue(values)) {
      issues.push({ line, message: `Aucune note lisible pour ${registrationNumber}.` });
      return;
    }

    parsed.push({ line, registrationNumber, values });
  });

  return { parsed, issues };
}

/** Résout les matricules (inscription ou participant) en identifiants d'inscription. */
async function resolveEnrollmentIds(
  db: Db,
  trainingSessionId: string,
  registrationNumbers: readonly string[],
): Promise<Map<string, string>> {
  const enrollments = await db.enrollment.findMany({
    where: {
      trainingSessionId,
      OR: [
        { registrationNumber: { in: [...registrationNumbers] } },
        { participant: { registrationNumber: { in: [...registrationNumbers] } } },
      ],
    },
    select: {
      id: true,
      registrationNumber: true,
      participant: { select: { registrationNumber: true } },
    },
  });

  const index = new Map<string, string>();
  for (const enrollment of enrollments) {
    if (enrollment.registrationNumber) index.set(enrollment.registrationNumber, enrollment.id);
    index.set(enrollment.participant.registrationNumber, enrollment.id);
  }
  return index;
}

/** Import des 2 notes écrites du test de positionnement (E.E, C.E). */
export async function importPositioningScores(
  db: Db,
  positioningTestId: string,
  rows: RawRow[],
): Promise<ImportScoresReport> {
  await assertPositioningTestWritable(db, positioningTestId);

  const test = await db.positioningTest.findUnique({
    where: { id: positioningTestId },
    select: { id: true },
  });
  if (!test) {
    throw validationError('Test de positionnement introuvable.', { positioningTestId });
  }

  const { parsed, issues } = parseScoreRows(
    rows,
    (row) => ({
      writtenExpression: toNumber(pick(row, COLUMNS.writtenExpression)),
      writtenComprehension: toNumber(pick(row, COLUMNS.writtenComprehension)),
    }),
    (values) => values.writtenExpression !== null || values.writtenComprehension !== null,
  );

  const report: ImportScoresReport = {
    rows: parsed.length,
    updated: 0,
    unmatched: [],
    issues: [...issues],
  };
  if (parsed.length === 0) return report;

  // Les notes du test peuvent porter sur des inscriptions de sessions variées :
  // on résout donc via les notes déjà rattachées au test.
  const scores = await db.positioningScore.findMany({
    where: { positioningTestId },
    select: {
      enrollmentId: true,
      enrollment: {
        select: {
          registrationNumber: true,
          participant: { select: { registrationNumber: true } },
          trainingSession: { select: { state: true } },
        },
      },
    },
  });

  const index = new Map<string, { enrollmentId: string; locked: boolean }>();
  for (const score of scores) {
    const entry = {
      enrollmentId: score.enrollmentId,
      locked: score.enrollment.trainingSession.state === 'LOCKED',
    };
    if (score.enrollment.registrationNumber) index.set(score.enrollment.registrationNumber, entry);
    index.set(score.enrollment.participant.registrationNumber, entry);
  }

  return withTransaction(db, async (tx) => {
    for (const row of parsed) {
      const target = index.get(row.registrationNumber);
      if (!target) {
        report.unmatched.push(row.registrationNumber);
        continue;
      }
      if (target.locked) {
        report.issues.push({
          line: row.line,
          message: `Session verrouillée pour ${row.registrationNumber} : note ignorée.`,
        });
        continue;
      }

      await tx.positioningScore.update({
        where: { enrollmentId: target.enrollmentId },
        data: row.values,
      });
      report.updated += 1;
    }
    return report;
  });
}

/** Import des 4 notes de délibération (E.O, E.E, C.O, C.E). */
export async function importDeliberationScores(
  db: Db,
  trainingSessionId: string,
  rows: RawRow[],
): Promise<ImportScoresReport> {
  await assertSessionWritable(db, trainingSessionId);

  const { parsed, issues } = parseScoreRows(
    rows,
    (row) => ({
      oralExpression: toNumber(pick(row, COLUMNS.oralExpression)),
      writtenExpression: toNumber(pick(row, COLUMNS.writtenExpression)),
      oralComprehension: toNumber(pick(row, COLUMNS.oralComprehension)),
      writtenComprehension: toNumber(pick(row, COLUMNS.writtenComprehension)),
    }),
    (values) => Object.values(values).some((value) => value !== null),
  );

  const report: ImportScoresReport = {
    rows: parsed.length,
    updated: 0,
    unmatched: [],
    issues: [...issues],
  };
  if (parsed.length === 0) return report;

  const index = await resolveEnrollmentIds(
    db,
    trainingSessionId,
    parsed.map((row) => row.registrationNumber),
  );

  return withTransaction(db, async (tx) => {
    for (const row of parsed) {
      const enrollmentId = index.get(row.registrationNumber);
      if (!enrollmentId) {
        report.unmatched.push(row.registrationNumber);
        continue;
      }

      await tx.deliberationEntry.upsert({
        where: { enrollmentId },
        update: row.values,
        create: { enrollmentId, ...row.values },
      });
      report.updated += 1;
    }
    return report;
  });
}
