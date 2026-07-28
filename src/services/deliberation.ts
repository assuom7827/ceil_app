/**
 * Délibération d'une session.
 *
 * Il n'existe pas d'entité `Deliberation` : la délibération EST l'ensemble des
 * `DeliberationEntry` des inscriptions de la session, et le seuil vit sur la
 * session. `total` et `status` sont dérivés — rien n'est persisté par le calcul.
 */
import type { Db } from './db';
import { deriveEntryTotalAndStatus, type AdmissionStatus } from './derive';
import { notFoundError } from './errors';
import { assertSessionWritable } from './locking';

export interface AdmissionSummary {
  admitted: number;
  refused: number;
  /** Inscriptions sans aucune note : non délibérées, ni admises ni ajournées. */
  pending: number;
  /** Inscriptions de la session. */
  total: number;
  admissionThreshold: number;
}

async function requireSession(db: Db, trainingSessionId: string) {
  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { id: true, admissionThreshold: true, state: true, dateFrom: true, dateTo: true },
  });
  if (!session) {
    throw notFoundError('Session de formation introuvable.', { trainingSessionId });
  }
  return session;
}

/**
 * Calcul PUR : compte les admis et les ajournés selon le seuil de la session.
 * Aucune écriture — le statut n'est jamais stocké.
 */
export async function computeAdmission(
  db: Db,
  trainingSessionId: string,
): Promise<AdmissionSummary> {
  const session = await requireSession(db, trainingSessionId);

  const enrollments = await db.enrollment.findMany({
    where: { trainingSessionId },
    select: {
      deliberationEntry: {
        select: {
          oralExpression: true,
          writtenExpression: true,
          oralComprehension: true,
          writtenComprehension: true,
        },
      },
    },
  });

  const summary: AdmissionSummary = {
    admitted: 0,
    refused: 0,
    pending: 0,
    total: enrollments.length,
    admissionThreshold: session.admissionThreshold,
  };

  for (const enrollment of enrollments) {
    const entry = enrollment.deliberationEntry;
    const { status } = entry
      ? deriveEntryTotalAndStatus(entry, session.admissionThreshold)
      : { status: null as AdmissionStatus | null };

    if (status === 'ADMITTED') summary.admitted += 1;
    else if (status === 'REFUSED') summary.refused += 1;
    else summary.pending += 1;
  }

  return summary;
}

/**
 * Lignes de délibération avec leurs colonnes calculées.
 * Toutes les inscriptions apparaissent, y compris celles sans notes, afin que
 * la grille de saisie soit exhaustive.
 */
export async function getDeliberation(db: Db, trainingSessionId: string) {
  const session = await requireSession(db, trainingSessionId);

  const enrollments = await db.enrollment.findMany({
    where: { trainingSessionId },
    orderBy: [{ participant: { familyName: 'asc' } }, { participant: { firstName: 'asc' } }],
    select: {
      id: true,
      registrationNumber: true,
      participant: {
        select: {
          id: true,
          familyName: true,
          firstName: true,
          arabName: true,
          arabFirstName: true,
          registrationNumber: true,
        },
      },
      assignedLevel: { select: { id: true, name: true } },
      sessionGroup: { select: { id: true, name: true } },
      deliberationEntry: true,
    },
  });

  return {
    trainingSessionId,
    state: session.state,
    admissionThreshold: session.admissionThreshold,
    rows: enrollments.map((enrollment) => {
      const entry = enrollment.deliberationEntry;
      const { total, status } = deriveEntryTotalAndStatus(entry ?? {}, session.admissionThreshold);

      return {
        enrollmentId: enrollment.id,
        entryId: entry?.id ?? null,
        enrollmentNumber: enrollment.registrationNumber,
        participant: enrollment.participant,
        assignedLevel: enrollment.assignedLevel,
        sessionGroup: enrollment.sessionGroup,
        oralExpression: entry?.oralExpression ?? null,
        writtenExpression: entry?.writtenExpression ?? null,
        oralComprehension: entry?.oralComprehension ?? null,
        writtenComprehension: entry?.writtenComprehension ?? null,
        // Colonnes calculées, en lecture seule dans la grille.
        total,
        status,
      };
    }),
  };
}

export interface DeliberationScoreInput {
  oralExpression?: number | null;
  writtenExpression?: number | null;
  oralComprehension?: number | null;
  writtenComprehension?: number | null;
}

/** Crée ou met à jour les 4 notes d'une inscription. */
export async function upsertDeliberationEntry(
  db: Db,
  trainingSessionId: string,
  enrollmentId: string,
  values: DeliberationScoreInput,
) {
  await assertSessionWritable(db, trainingSessionId);

  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentId, trainingSessionId },
    select: { id: true },
  });
  if (!enrollment) {
    throw notFoundError('Inscription introuvable dans cette session.', {
      enrollmentId,
      trainingSessionId,
    });
  }

  return db.deliberationEntry.upsert({
    where: { enrollmentId },
    update: values,
    create: { enrollmentId, ...values },
  });
}

/** Inscriptions admises d'une session — source des diplômes. */
export async function getAdmittedEnrollments(db: Db, trainingSessionId: string) {
  const deliberation = await getDeliberation(db, trainingSessionId);
  return deliberation.rows.filter((row) => row.status === 'ADMITTED');
}
