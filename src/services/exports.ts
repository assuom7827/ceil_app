/**
 * Exports des données brutes d'une session de formation en CSV ou Excel.
 *
 * Le formatage est centralisé ici : chaque type d'export produit des feuilles
 * (en-têtes + lignes), ensuite le classeur est assemblé avec `xlsx`. Les valeurs
 * dérivées (nom complet, total, statut) proviennent de `derive.ts` — source
 * unique de vérité partagée avec l'UI et les documents officiels.
 *
 * Le service reçoit son `Db` en argument (comme `documents.ts`, `deliberation.ts`)
 * : aucune dépendance globale, testable en isolation.
 */
import * as XLSX from 'xlsx';
import type { Db } from './db';
import { getDeliberation } from './deliberation';
import { deriveParticipantFullName, deriveParticipantArabicFullName } from './derive';
import { formatDate } from '@/lib/date-format';
import { notFoundError } from './errors';

export type ExportKind = 'enrollments' | 'scores';
export type ExportFormat = 'xlsx' | 'csv';

export interface ExportResult {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
  /** Nombre de lignes de données (hors en-tête) dans la feuille principale. */
  count: number;
}

/** Une feuille : nom, en-têtes français, puis les lignes de valeurs. */
interface SheetSpec {
  name: string;
  headers: string[];
  rows: unknown[][];
}

function dateFmt(date: Date | null | undefined): string {
  return formatDate(date);
}

function numFmt(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function kindLabel(kind: 'NEW' | 'RETURNING' | null | undefined): string {
  if (kind === 'NEW') return 'Nouveau';
  if (kind === 'RETURNING') return 'Ancien';
  return '';
}

function typeLabel(type: 'STUDENT' | 'TEACHER' | null | undefined): string {
  if (type === 'TEACHER') return 'Enseignant';
  if (type === 'STUDENT') return 'Étudiant';
  return '';
}

function statusLabel(status: 'ADMITTED' | 'REFUSED' | null | undefined): string {
  if (status === 'ADMITTED') return 'Admis';
  if (status === 'REFUSED') return 'Ajourné';
  return 'Non délibéré';
}

// ---------------------------------------------------------------------------
// Feuille : Inscrits
// ---------------------------------------------------------------------------

async function buildEnrollmentsSheet(db: Db, sessionId: string): Promise<SheetSpec> {
  const session = await db.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) throw notFoundError('Session de formation introuvable.', { sessionId });

  const enrollments = await db.enrollment.findMany({
    where: { trainingSessionId: sessionId },
    orderBy: [{ participant: { familyName: 'asc' } }, { participant: { firstName: 'asc' } }],
    select: {
      registrationNumber: true,
      responsible: true,
      enrolledAt: true,
      kind: true,
      participant: {
        select: {
          familyName: true,
          firstName: true,
          arabName: true,
          arabFirstName: true,
          registrationNumber: true,
          phone: true,
          email: true,
          type: true,
        },
      },
      assignedLevel: { select: { name: true } },
      sessionGroup: { select: { name: true, site: true, startTime: true, endTime: true } },
      examGroup: { select: { name: true } },
    },
  });

  const headers = [
    'Matricule inscription',
    'Matricule participant',
    'Nom',
    'Prénom',
    'Nom arabe',
    'Prénom arabe',
    'Nom complet',
    'Nom complet arabe',
    'Type',
    'Catégorie',
    'Niveau',
    'Groupe session',
    'Groupe examen',
    'Site',
    'Horaire',
    'Téléphone',
    'E-mail',
    'Responsable',
    'Date inscription',
  ];

  const rows = enrollments.map((e) => {
    const fullName = deriveParticipantFullName(e.participant);
    const arabicFullName = deriveParticipantArabicFullName(e.participant);
    const schedule =
      e.sessionGroup && (e.sessionGroup.startTime || e.sessionGroup.endTime)
        ? `${e.sessionGroup.startTime ?? ''} – ${e.sessionGroup.endTime ?? ''}`
        : '';

    return [
      e.registrationNumber ?? '',
      e.participant.registrationNumber,
      e.participant.familyName ?? '',
      e.participant.firstName ?? '',
      e.participant.arabName ?? '',
      e.participant.arabFirstName ?? '',
      fullName,
      arabicFullName,
      typeLabel(e.participant.type),
      kindLabel(e.kind),
      e.assignedLevel?.name ?? '',
      e.sessionGroup?.name ?? '',
      e.examGroup?.name ?? '',
      e.sessionGroup?.site ?? '',
      schedule,
      e.participant.phone ?? '',
      e.participant.email ?? '',
      e.responsible ?? '',
      dateFmt(e.enrolledAt),
    ] as unknown[];
  });

  return { name: 'Inscrits', headers, rows };
}

// ---------------------------------------------------------------------------
// Feuille : Notes / Délibération
// ---------------------------------------------------------------------------

async function buildScoresSheet(db: Db, sessionId: string): Promise<SheetSpec> {
  const deliberation = await getDeliberation(db, sessionId);

  const headers = [
    'Matricule inscription',
    'Matricule participant',
    'Nom',
    'Prénom',
    'Nom arabe',
    'Prénom arabe',
    'Nom complet arabe',
    'Niveau',
    'Groupe session',
    'Enseignant',
    'E.O',
    'E.E',
    'C.O',
    'C.E',
    'Total',
    'Statut',
  ];

  const rows = deliberation.rows.map((row) => [
    row.enrollmentNumber ?? row.participant.registrationNumber,
    row.participant.registrationNumber,
    row.participant.familyName ?? '',
    row.participant.firstName ?? '',
    row.participant.arabName ?? '',
    row.participant.arabFirstName ?? '',
    deriveParticipantArabicFullName(row.participant),
    row.assignedLevel?.name ?? '',
    row.sessionGroup?.name ?? '',
    row.sessionGroup?.teacher?.name ?? '',
    numFmt(row.oralExpression),
    numFmt(row.writtenExpression),
    numFmt(row.oralComprehension),
    numFmt(row.writtenComprehension),
    numFmt(row.total),
    statusLabel(row.status),
  ]);

  return { name: 'Notes', headers, rows };
}

// ---------------------------------------------------------------------------
// Orchestrateur : assemble les feuilles et produit le fichier
// ---------------------------------------------------------------------------

/** Feuilles d'un type d'export. */
function sheetsFor(db: Db, sessionId: string, kind: ExportKind): Promise<SheetSpec[]> {
  if (kind === 'enrollments') return buildEnrollmentsSheet(db, sessionId).then((s) => [s]);
  if (kind === 'scores') return buildScoresSheet(db, sessionId).then((s) => [s]);
  throw notFoundError(`Type d'export inconnu : ${kind}`, { kind });
}

/**
 * Génère le fichier binaire (XLSX ou CSV) pour un type d'export.
 *
 * Pour le XLSX, toutes les feuilles sont incluses. Pour le CSV, seule la
 * première feuille est exportée — un fichier CSV ne peut porter plusieurs onglets.
 */
export async function buildSessionExport(
  db: Db,
  sessionId: string,
  kind: ExportKind,
  format: ExportFormat,
): Promise<ExportResult> {
  const sheets = await sheetsFor(db, sessionId, kind);
  const primary = sheets[0];
  if (!primary) {
    throw notFoundError('Aucune donnée à exporter pour cette session.', { sessionId });
  }

  const fileNameBase = `ceil-session-${sessionId}-${kind}`;

  if (format === 'csv') {
    const ws = XLSX.utils.aoa_to_sheet([primary.headers, ...primary.rows]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return {
      bytes: new TextEncoder().encode(csv),
      contentType: 'text/csv; charset=utf-8',
      fileName: `${fileNameBase}.csv`,
      count: primary.rows.length,
    };
  }

  // XLSX : toutes les feuilles.
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return {
    bytes: new Uint8Array(wbout),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName: `${fileNameBase}.xlsx`,
    count: primary.rows.length,
  };
}
