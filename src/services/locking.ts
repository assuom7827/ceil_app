/**
 * Verrouillage OPEN / LOCKED.
 *
 * Une session verrouillée gèle ses inscriptions, ses lignes de délibération et
 * ses groupes réels ; un test verrouillé gèle ses notes de positionnement.
 * Toute tentative d'écriture lève une erreur 409.
 */
import type { Db } from './db';
import { lockedError, notFoundError } from './errors';

export type WorkflowState = 'OPEN' | 'LOCKED';

// ---------------------------------------------------------------------------
// Session de formation
// ---------------------------------------------------------------------------

export async function getSessionState(db: Db, trainingSessionId: string): Promise<WorkflowState> {
  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { state: true },
  });
  if (!session) {
    throw notFoundError('Session de formation introuvable.', { trainingSessionId });
  }
  return session.state;
}

/** Refuse toute écriture sur une session verrouillée. */
export async function assertSessionWritable(db: Db, trainingSessionId: string): Promise<void> {
  if ((await getSessionState(db, trainingSessionId)) === 'LOCKED') {
    throw lockedError(
      'Cette session est verrouillée : inscriptions, notes et groupes ne peuvent plus être modifiés.',
      { trainingSessionId },
    );
  }
}

/**
 * Refuse toute écriture sur une ligne (inscription, note, entrée de
 * délibération) dont la session porteuse est verrouillée.
 */
export async function assertEnrollmentWritable(db: Db, enrollmentId: string): Promise<void> {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { trainingSessionId: true, trainingSession: { select: { state: true } } },
  });
  if (!enrollment) {
    throw notFoundError('Inscription introuvable.', { enrollmentId });
  }
  if (enrollment.trainingSession.state === 'LOCKED') {
    throw lockedError('La session de cette inscription est verrouillée.', {
      enrollmentId,
      trainingSessionId: enrollment.trainingSessionId,
    });
  }
}

export async function setSessionState(db: Db, trainingSessionId: string, state: WorkflowState) {
  await getSessionState(db, trainingSessionId); // 404 si absente
  return db.trainingSession.update({ where: { id: trainingSessionId }, data: { state } });
}

export const lockSession = (db: Db, id: string) => setSessionState(db, id, 'LOCKED');
export const unlockSession = (db: Db, id: string) => setSessionState(db, id, 'OPEN');

// ---------------------------------------------------------------------------
// Test de positionnement
// ---------------------------------------------------------------------------

export async function getPositioningTestState(db: Db, testId: string): Promise<WorkflowState> {
  const test = await db.positioningTest.findUnique({
    where: { id: testId },
    select: { state: true },
  });
  if (!test) {
    throw notFoundError('Test de positionnement introuvable.', { positioningTestId: testId });
  }
  return test.state;
}

export async function assertPositioningTestWritable(db: Db, testId: string): Promise<void> {
  if ((await getPositioningTestState(db, testId)) === 'LOCKED') {
    throw lockedError('Ce test de positionnement est verrouillé : les notes sont figées.', {
      positioningTestId: testId,
    });
  }
}

export async function setPositioningTestState(db: Db, testId: string, state: WorkflowState) {
  await getPositioningTestState(db, testId); // 404 si absent
  return db.positioningTest.update({ where: { id: testId }, data: { state } });
}

export const lockPositioningTest = (db: Db, id: string) =>
  setPositioningTestState(db, id, 'LOCKED');
export const unlockPositioningTest = (db: Db, id: string) =>
  setPositioningTestState(db, id, 'OPEN');
