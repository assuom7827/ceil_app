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
      // « N° » est l'abréviation courante de « numéro » : en rendant le signe
      // degré, on retombe sur l'alias « no ». Un « N » seul — souvent un simple
      // numéro de ligne — reste volontairement non reconnu.
      .replace(/°/g, 'o')
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

/**
 * Comme `pick`, mais rend la valeur BRUTE de la cellule.
 *
 * Une date lue depuis un classeur peut arriver en objet `Date` ou en numéro de
 * série Excel : la convertir en texte trop tôt perdrait cette information.
 */
export function pickRaw(row: RawRow, aliases: readonly string[]): unknown {
  for (const alias of aliases) {
    const value = row[alias];
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim().length === 0) continue;
    return value;
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
  // « Né(e) le » se normalise en « ne e le » ; « Né le » en « ne le ».
  birthDate: [
    'date de naissance',
    'date naissance',
    'naissance',
    'ne le',
    'nee le',
    'ne e le',
    'date of birth',
    'birth date',
    'تاريخ الميلاد',
    'تاريخ الازدياد',
  ],
  birthPlace: [
    'lieu de naissance',
    'lieu naissance',
    'ne a',
    'nee a',
    'ne e a',
    'birth place',
    'place of birth',
    'مكان الميلاد',
    'مكان الازدياد',
  ],
  arabBirthPlace: ['lieu de naissance arabe', 'lieu naissance arabe', 'مكان الميلاد بالعربية'],
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

// ---------------------------------------------------------------------------
// Dates de naissance
// ---------------------------------------------------------------------------

/**
 * Lecture d'une date de naissance.
 *
 * `approximate` couvre le cas fréquent des états civils anciens : « vers 1975 »
 * ou une année seule. Plutôt que d'inventer un 1er janvier, on conserve la
 * mention telle quelle — c'est ce que le modèle appelle `approximateBirth`.
 */
export type ParsedBirthDate =
  | { kind: 'empty' }
  | { kind: 'date'; date: Date }
  | { kind: 'approximate'; text: string }
  | { kind: 'invalid'; text: string };

/** Origine du calendrier Excel : le sérial 1 vaut le 1er janvier 1900. */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
/** En deçà, une date de naissance relève de la faute de frappe. */
const EARLIEST_BIRTH_YEAR = 1900;
/**
 * Au-delà, un nombre ne peut plus être une année : c'est un sérial Excel.
 * Le sérial 10000 tombe en 1927, donc aucune année plausible ne l'atteint.
 */
const SERIAL_FLOOR = 10_000;

const APPROXIMATE_PREFIX = /^(?:vers|environ|env\.?|circa|ca\.?|~|حوالي|نحو)\s*\S/i;

function isPlausibleYear(year: number, today: Date): boolean {
  return Number.isInteger(year) && year >= EARLIEST_BIRTH_YEAR && year <= today.getFullYear();
}

/** Construit une date UTC en refusant les jours qui n'existent pas (31/02). */
function buildDate(year: number, month: number, day: number, today: Date): ParsedBirthDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;
  if (date.getUTCDate() !== day) return null;
  if (!isPlausibleYear(year, today) || date.getTime() > today.getTime()) return null;
  return { kind: 'date', date };
}

/**
 * Année sur deux chiffres : on retient la plus récente qui ne soit pas dans le
 * futur. En 2026, « 98 » donne 1998 et « 05 » donne 2005.
 */
function expandYear(value: number, today: Date): number {
  if (value >= 100) return value;
  const recent = 2000 + value;
  return recent > today.getFullYear() ? 1900 + value : recent;
}

/**
 * Lit une date de naissance venue d'un tableur.
 *
 * Formats acceptés : cellule date Excel, sérial Excel, `JJ/MM/AAAA` (séparateurs
 * `/ . -`), `AAAA-MM-JJ`, année seule, mention approximative. Le jour vient en
 * premier — convention française ; un fichier américain reste correctement lu
 * dès que le second nombre dépasse 12 (`7/28/1998`), car il ne peut être un mois.
 */
export function parseBirthDate(value: unknown, now: Date = new Date()): ParsedBirthDate {
  if (value === null || value === undefined) return { kind: 'empty' };

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { kind: 'invalid', text: String(value) };
    return (
      buildDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate(), now) ?? {
        kind: 'invalid',
        text: value.toISOString().slice(0, 10),
      }
    );
  }

  if (typeof value === 'number') return fromNumber(value, String(value), now);

  const text = String(value).trim();
  if (text.length === 0) return { kind: 'empty' };

  // « vers 1975 », « حوالي 1975 » : mention conservée mot pour mot.
  if (APPROXIMATE_PREFIX.test(text)) return { kind: 'approximate', text };

  if (/^\d+$/.test(text)) return fromNumber(Number(text), text, now);

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  if (iso) {
    return (
      buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), now) ?? { kind: 'invalid', text }
    );
  }

  const parts = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(text);
  if (parts) {
    const first = Number(parts[1]);
    const second = Number(parts[2]);
    const year = expandYear(Number(parts[3]), now);
    // Un second nombre supérieur à 12 ne peut pas être un mois : le fichier est
    // au format mois/jour/année.
    const [day, month] = second > 12 ? [second, first] : [first, second];
    return buildDate(year, month, day, now) ?? { kind: 'invalid', text };
  }

  return { kind: 'invalid', text };
}

function fromNumber(value: number, text: string, now: Date): ParsedBirthDate {
  if (isPlausibleYear(value, now)) return { kind: 'approximate', text: String(value) };
  if (value >= SERIAL_FLOOR) {
    const date = new Date(EXCEL_EPOCH_UTC + Math.round(value) * DAY_MS);
    return (
      buildDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), now) ?? {
        kind: 'invalid',
        text,
      }
    );
  }
  return { kind: 'invalid', text };
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
  birthDate: Date | null;
  /** Mention en clair quand la date n'est pas exacte (« vers 1975 », « 1998 »). */
  approximateBirth: string | null;
  birthPlace: string | null;
  arabBirthPlace: string | null;
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

    // Une date illisible ne fait pas perdre la ligne : le participant compte
    // plus que sa date de naissance, mais l'anomalie est signalée pour être
    // corrigée dans le fichier.
    const birth = parseBirthDate(pickRaw(row, COLUMNS.birthDate));
    if (birth.kind === 'invalid') {
      issues.push({
        line,
        message: `Date de naissance illisible : « ${birth.text} » (attendu JJ/MM/AAAA). Le reste de la ligne est conservé.`,
      });
    }

    parsed.push({
      line,
      familyName,
      firstName,
      arabName,
      arabFirstName: pick(row, COLUMNS.arabFirstName),
      type: parseParticipantType(pick(row, COLUMNS.type)),
      birthDate: birth.kind === 'date' ? birth.date : null,
      approximateBirth: birth.kind === 'approximate' ? birth.text : null,
      birthPlace: pick(row, COLUMNS.birthPlace),
      arabBirthPlace: pick(row, COLUMNS.arabBirthPlace),
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
  /** Participants rapprochés dont une fiche incomplète a été complétée. */
  participantsCompleted: number;
  enrolled: number;
  /** Déjà inscrits : ignorés sans erreur. */
  skipped: number;
  issues: ImportIssue[];
}

/** Champs d'état civil qu'un import peut renseigner sur une fiche existante. */
const CIVIL_FIELDS = ['birthPlace', 'arabBirthPlace', 'approximateBirth'] as const;

interface CivilStatus {
  birthDate: Date | null;
  approximateBirth: string | null;
  birthPlace: string | null;
  arabBirthPlace: string | null;
}

/** Deux dates désignent-elles le même jour ? */
function sameDay(left: Date, right: Date): boolean {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

/**
 * Ce que le fichier ajoute à une fiche existante.
 *
 * On ne complète que les champs VIDES. Une valeur déjà saisie n'est jamais
 * écrasée : le fichier importé n'est pas plus fiable que la fiche, et une
 * divergence mérite d'être arbitrée par un humain — elle est donc signalée.
 */
export function planCivilStatusUpdate(
  existing: CivilStatus,
  row: Pick<
    ParsedEnrollmentRow,
    'birthDate' | 'approximateBirth' | 'birthPlace' | 'arabBirthPlace'
  >,
): { data: Partial<CivilStatus> & { birthDateIsApproximate?: boolean }; conflicts: string[] } {
  const data: Partial<CivilStatus> & { birthDateIsApproximate?: boolean } = {};
  const conflicts: string[] = [];

  if (row.birthDate) {
    if (!existing.birthDate) {
      data.birthDate = row.birthDate;
      data.birthDateIsApproximate = false;
    } else if (!sameDay(existing.birthDate, row.birthDate)) {
      conflicts.push('date de naissance');
    }
  }

  for (const field of CIVIL_FIELDS) {
    const value = row[field];
    if (!value) continue;
    if (!existing[field]) {
      data[field] = value;
      if (field === 'approximateBirth' && !existing.birthDate) data.birthDateIsApproximate = true;
    } else if (existing[field] !== value) {
      conflicts.push(field === 'approximateBirth' ? 'date de naissance' : 'lieu de naissance');
    }
  }

  return { data, conflicts: [...new Set(conflicts)] };
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
  actorId?: string,
  actorRole?: 'MANAGER' | 'USER' | 'ADMIN',
): Promise<ImportEnrollmentsReport> {
  await assertSessionWritable(
    db,
    trainingSessionId,
    actorId && actorRole ? { id: actorId, role: actorRole } : null,
  );

  const { parsed, issues } = parseEnrollmentRows(rows);
  const report: ImportEnrollmentsReport = {
    rows: parsed.length,
    participantsCreated: 0,
    participantsMatched: 0,
    participantsCompleted: 0,
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
          select: {
            id: true,
            birthDate: true,
            approximateBirth: true,
            birthPlace: true,
            arabBirthPlace: true,
          },
        });
        if (existing) {
          participantIds.push(existing.id);
          report.participantsMatched += 1;

          const { data, conflicts } = planCivilStatusUpdate(existing, row);
          if (Object.keys(data).length > 0) {
            await tx.participant.update({ where: { id: existing.id }, data });
            report.participantsCompleted += 1;
          }
          for (const conflict of conflicts) {
            report.issues.push({
              line: row.line,
              message: `${row.registrationNumber} : ${conflict} déjà renseignée et différente du fichier — fiche inchangée.`,
            });
          }
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
        birthDate: row.birthDate,
        approximateBirth: row.approximateBirth,
        birthPlace: row.birthPlace,
        arabBirthPlace: row.arabBirthPlace,
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
  actorId?: string,
  actorRole?: 'MANAGER' | 'USER' | 'ADMIN',
): Promise<ImportScoresReport> {
  await assertSessionWritable(
    db,
    trainingSessionId,
    actorId && actorRole ? { id: actorId, role: actorRole } : null,
  );

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
