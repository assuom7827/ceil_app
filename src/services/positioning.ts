/**
 * Test de positionnement : total = E.E + C.E, niveau résolu par intervalle
 * semi-ouvert `[minimumPoints, maximumPoints[`.
 *
 * Le niveau résolu n'est PAS stocké : `resolveLevels` écrit la décision dans
 * `Enrollment.assignedLevel`, qui est une donnée réelle (le niveau attribué au
 * participant), et non une valeur dérivée.
 */
import type { Db } from './db';
import { withTransaction } from './db';
import { derivePositioningTotal, resolveLevelForPoints, type LevelIntervalInput } from './derive';
import { notFoundError } from './errors';
import { assertPositioningTestWritable } from './locking';

export interface ResolveLevelsResult {
  /** Inscriptions dont le niveau attribué a changé. */
  updated: number;
  /** Notes examinées. */
  total: number;
  /** Notes dont le total ne tombe dans aucun intervalle (ou sans note). */
  unresolved: number;
  /** Notes ignorées car leur session est verrouillée. */
  skippedLocked: number;
}

/** Niveaux actifs proposés par la formation du test, triés par séquence. */
async function levelsForTraining(db: Db, trainingId: string): Promise<LevelIntervalInput[]> {
  return db.trainingLevel.findMany({
    where: { disabled: false, trainings: { some: { id: trainingId } } },
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      name: true,
      sequence: true,
      minimumPoints: true,
      maximumPoints: true,
      disabled: true,
    },
  });
}

/**
 * Applique le niveau résolu de chaque note à `Enrollment.assignedLevel`.
 *
 * Le test doit être ouvert. Les notes dont la session est verrouillée sont
 * comptées dans `skippedLocked` plutôt que d'échouer : un test peut porter sur
 * des inscriptions de plusieurs sessions, et l'une d'elles peut être close.
 */
export async function resolveLevels(
  db: Db,
  positioningTestId: string,
): Promise<ResolveLevelsResult> {
  await assertPositioningTestWritable(db, positioningTestId);

  const test = await db.positioningTest.findUnique({
    where: { id: positioningTestId },
    select: { id: true, trainingId: true },
  });
  if (!test) {
    throw notFoundError('Test de positionnement introuvable.', { positioningTestId });
  }

  const levels = await levelsForTraining(db, test.trainingId);

  const scores = await db.positioningScore.findMany({
    where: { positioningTestId },
    select: {
      writtenExpression: true,
      writtenComprehension: true,
      enrollment: {
        select: {
          id: true,
          assignedLevelId: true,
          trainingSession: { select: { state: true } },
        },
      },
    },
  });

  const result: ResolveLevelsResult = {
    updated: 0,
    total: scores.length,
    unresolved: 0,
    skippedLocked: 0,
  };

  const updates: Array<{ enrollmentId: string; levelId: string }> = [];

  for (const score of scores) {
    if (score.enrollment.trainingSession.state === 'LOCKED') {
      result.skippedLocked += 1;
      continue;
    }

    const total = derivePositioningTotal(score);
    const level = resolveLevelForPoints(levels, total);

    if (!level) {
      result.unresolved += 1;
      continue;
    }
    // Une réaffectation à l'identique n'est pas une mise à jour.
    if (score.enrollment.assignedLevelId === level.id) continue;

    updates.push({ enrollmentId: score.enrollment.id, levelId: level.id });
  }

  if (updates.length > 0) {
    await withTransaction(db, async (tx) => {
      for (const update of updates) {
        await tx.enrollment.update({
          where: { id: update.enrollmentId },
          data: { assignedLevelId: update.levelId },
        });
      }
    });
  }

  result.updated = updates.length;
  return result;
}

/**
 * Lignes du test avec leurs colonnes calculées (`total`, `resolvedLevel`).
 * Alimente la grille de l'onglet Positionnement.
 */
export async function getPositioningRows(db: Db, positioningTestId: string) {
  const test = await db.positioningTest.findUnique({
    where: { id: positioningTestId },
    select: { id: true, trainingId: true, state: true },
  });
  if (!test) {
    throw notFoundError('Test de positionnement introuvable.', { positioningTestId });
  }

  const levels = await levelsForTraining(db, test.trainingId);

  const scores = await db.positioningScore.findMany({
    where: { positioningTestId },
    select: {
      id: true,
      writtenExpression: true,
      writtenComprehension: true,
      enrollment: {
        select: {
          id: true,
          registrationNumber: true,
          assignedLevel: { select: { id: true, name: true } },
          participant: {
            select: { id: true, familyName: true, firstName: true, registrationNumber: true },
          },
        },
      },
    },
  });

  return {
    state: test.state,
    rows: scores.map((score) => {
      const total = derivePositioningTotal(score);
      const resolvedLevel = resolveLevelForPoints(levels, total);
      return {
        scoreId: score.id,
        enrollmentId: score.enrollment.id,
        participant: score.enrollment.participant,
        enrollmentNumber: score.enrollment.registrationNumber,
        writtenExpression: score.writtenExpression,
        writtenComprehension: score.writtenComprehension,
        // Colonnes calculées, en lecture seule dans la grille.
        total,
        resolvedLevel: resolvedLevel ? { id: resolvedLevel.id, name: resolvedLevel.name } : null,
        assignedLevel: score.enrollment.assignedLevel,
      };
    }),
  };
}

/**
 * Grille de positionnement vue depuis la SESSION : toutes les inscriptions
 * apparaissent, y compris celles sans note, sans quoi la saisie ne pourrait pas
 * commencer. Les notes sont rattachées au test choisi.
 */
export async function getSessionPositioning(
  db: Db,
  trainingSessionId: string,
  positioningTestId: string,
) {
  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { id: true, state: true, trainingId: true },
  });
  if (!session) {
    throw notFoundError('Session de formation introuvable.', { trainingSessionId });
  }

  const test = await db.positioningTest.findUnique({
    where: { id: positioningTestId },
    select: { id: true, title: true, state: true, trainingId: true },
  });
  if (!test) {
    throw notFoundError('Test de positionnement introuvable.', { positioningTestId });
  }

  const levels = await levelsForTraining(db, test.trainingId);

  const enrollments = await db.enrollment.findMany({
    where: { trainingSessionId },
    orderBy: [{ participant: { familyName: 'asc' } }, { participant: { firstName: 'asc' } }],
    select: {
      id: true,
      registrationNumber: true,
      participant: {
        select: { id: true, familyName: true, firstName: true, registrationNumber: true },
      },
      assignedLevel: { select: { id: true, name: true } },
      positioningScore: {
        select: {
          id: true,
          positioningTestId: true,
          writtenExpression: true,
          writtenComprehension: true,
        },
      },
    },
  });

  return {
    test: { id: test.id, title: test.title, state: test.state },
    // La grille est figée si le test OU la session est verrouillé.
    readOnly: test.state === 'LOCKED' || session.state === 'LOCKED',
    levels: levels.map((level) => ({ id: level.id, name: level.name })),
    rows: enrollments.map((enrollment) => {
      // Une note d'un autre test ne doit pas s'afficher dans cette grille.
      const score =
        enrollment.positioningScore?.positioningTestId === test.id
          ? enrollment.positioningScore
          : null;

      const total = derivePositioningTotal(score ?? {});
      const resolvedLevel = resolveLevelForPoints(levels, total);

      return {
        enrollmentId: enrollment.id,
        enrollmentNumber: enrollment.registrationNumber,
        participant: enrollment.participant,
        writtenExpression: score?.writtenExpression ?? null,
        writtenComprehension: score?.writtenComprehension ?? null,
        total,
        resolvedLevel: resolvedLevel ? { id: resolvedLevel.id, name: resolvedLevel.name } : null,
        assignedLevel: enrollment.assignedLevel,
      };
    }),
  };
}

/** Crée ou met à jour la note de positionnement d'une inscription. */
export async function upsertPositioningScore(
  db: Db,
  positioningTestId: string,
  enrollmentId: string,
  values: { writtenExpression?: number | null; writtenComprehension?: number | null },
) {
  await assertPositioningTestWritable(db, positioningTestId);

  return db.positioningScore.upsert({
    where: { enrollmentId },
    update: values,
    create: { enrollmentId, positioningTestId, ...values },
  });
}
