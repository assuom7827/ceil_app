/**
 * Verrouillage OPEN / LOCKED.
 *
 * Une session verrouillée gèle ses inscriptions, ses lignes de délibération et
 * ses groupes réels ; un test verrouillé gèle ses notes de positionnement.
 * Toute tentative d'écriture lève une erreur 409.
 */
import type { Db } from './db';
import { lockedError, notFoundError, forbiddenError } from './errors';
import { logAudit } from './audit';
import type { Actor } from './rbac';

export type WorkflowState = 'OPEN' | 'LOCKED';

export const ACTION_SESSION_LOCKED = 'SESSION_LOCKED';
export const ACTION_SESSION_UNLOCKED = 'SESSION_UNLOCKED';
export const ACTION_POSITIONING_LOCKED = 'POSITIONING_TEST_LOCKED';
export const ACTION_POSITIONING_UNLOCKED = 'POSITIONING_TEST_UNLOCKED';

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

export async function assertSessionAccess(
  db: Db,
  trainingSessionId: string,
  actor: Actor | null | undefined,
): Promise<void> {
  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { id: true },
  });
  if (!session) {
    throw notFoundError('Session de formation introuvable.', { trainingSessionId });
  }

  if (!actor) return;
  if (actor.role === 'MANAGER' || actor.role === 'ADMIN') return;

  const delegation = await db.sessionAgent.findFirst({
    where: { trainingSessionId, userId: actor.id },
    select: { id: true },
  });

  if (!delegation) {
    throw forbiddenError("Vous n'êtes pas délégué sur cette session.", {
      trainingSessionId,
    });
  }
}

/** Refuse toute écriture sur une session verrouillée ou inaccessible. */
export async function assertSessionWritable(
  db: Db,
  trainingSessionId: string,
  actor: Actor | null | undefined,
): Promise<void> {
  await assertSessionAccess(db, trainingSessionId, actor);

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

export async function setSessionState(
  db: Db,
  trainingSessionId: string,
  state: WorkflowState,
  actorId?: string,
) {
  await getSessionState(db, trainingSessionId); // 404 si absente
  const previous = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { state: true },
  });
  const updated = await db.trainingSession.update({ where: { id: trainingSessionId }, data: { state } });

  if (actorId && previous?.state !== state) {
    await logAudit(db, {
      actorId,
      action: state === 'LOCKED' ? ACTION_SESSION_LOCKED : ACTION_SESSION_UNLOCKED,
      entityType: 'TrainingSession',
      entityId: trainingSessionId,
      oldValue: { state: previous?.state },
      newValue: { state: updated.state },
    });
  }

  return updated;
}

export const lockSession = (db: Db, id: string, actorId?: string) =>
  setSessionState(db, id, 'LOCKED', actorId);
export const unlockSession = (db: Db, id: string, actorId?: string) =>
  setSessionState(db, id, 'OPEN', actorId);

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

export async function setPositioningTestState(
  db: Db,
  testId: string,
  state: WorkflowState,
  actorId?: string,
) {
  await getPositioningTestState(db, testId); // 404 si absent
  const previous = await db.positioningTest.findUnique({
    where: { id: testId },
    select: { state: true },
  });
  const updated = await db.positioningTest.update({ where: { id: testId }, data: { state } });

  if (actorId && previous?.state !== state) {
    await logAudit(db, {
      actorId,
      action: state === 'LOCKED' ? ACTION_POSITIONING_LOCKED : ACTION_POSITIONING_UNLOCKED,
      entityType: 'PositioningTest',
      entityId: testId,
      oldValue: { state: previous?.state },
      newValue: { state: updated.state },
    });
  }

  return updated;
}

export const lockPositioningTest = (db: Db, id: string, actorId?: string) =>
  setPositioningTestState(db, id, 'LOCKED', actorId);
export const unlockPositioningTest = (db: Db, id: string, actorId?: string) =>
  setPositioningTestState(db, id, 'OPEN', actorId);
