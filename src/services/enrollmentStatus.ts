/**
 * Machine à états des statuts d'inscription.
 *
 * Le statut d'une inscription est géré par des TRANSITIONS contrôlées :
 * aucun service ne modifie `status` directement en dehors de `transitionEnrollmentStatus`.
 *
 * Chaque transition vérifie :
 *   1. la délégation de session via `assertSessionWritable` (RBAC + verrouillage) ;
 *   2. la validité de l'enchaînement via `ALLOWED_TRANSITIONS`.
 *
 * La table `ALLOWED_TRANSITIONS` est la source unique de vérité — une
 * transition non listée y est refusée avec 409 Conflict.
 */
import { conflictError, notFoundError } from './errors';
import { assertSessionWritable } from './locking';
import { logAudit } from './audit';
import type { Db } from './db';

export type EnrollmentStatusLike =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

/**
 * Transitions autorisées depuis chaque statut.
 *
 * Les statuts terminaux (COMPLETED, CANCELLED, REJECTED) n'ont aucune sortie :
 * une fois l'inscription clôturée, son cycle est irréversible.
 */
export const ALLOWED_TRANSITIONS: Record<EnrollmentStatusLike, EnrollmentStatusLike[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  CONFIRMED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export const ACTION_ENROLLMENT_STATUS_CHANGED = 'ENROLLMENT_STATUS_CHANGED';

export interface EnrollmentStatusTransitionInput {
  enrollmentId: string;
  newStatus: EnrollmentStatusLike;
  actorId: string;
  actorRole: 'MANAGER' | 'USER' | 'ADMIN';
  reason?: string;
}

export interface EnrollmentStatusTransitionResult {
  id: string;
  status: EnrollmentStatusLike;
  previousStatus: EnrollmentStatusLike;
  statusChangedAt: Date;
  statusChangedBy: string;
  enrollmentId: string;
}

/**
 * Vérifie qu'une transition est autorisée par la machine à états. */
export function isTransitionAllowed(
  current: EnrollmentStatusLike,
  target: EnrollmentStatusLike,
): boolean {
  if (current === target) return false;
  return ALLOWED_TRANSITIONS[current].includes(target);
}

/**
 * Effectue une transition de statut d'inscription.
 *
 * - Refuse 404 si l'inscription n'existe pas.
 * - Refuse 403 si l'acteur n'est pas délégué sur la session (via
 *   `assertSessionWritable`, qui intègre aussi la vérification du verrouillage
 *   et lève 409 si la session est LOCKED).
 * - Refuse 409 si la transition n'est pas autorisée par `ALLOWED_TRANSITIONS`.
 *
 * Chaque transition est tracée dans `AuditLog` avec l'ancien et le nouveau
 * statut, ainsi que la raison éventuelle.
 */
export async function transitionEnrollmentStatus(
  db: Db,
  enrollmentId: string,
  newStatus: EnrollmentStatusLike,
  actorId: string,
  actorRole: 'MANAGER' | 'USER' | 'ADMIN',
  reason?: string,
): Promise<EnrollmentStatusTransitionResult> {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      status: true,
      trainingSessionId: true,
    },
  });
  if (!enrollment) {
    throw notFoundError('Inscription introuvable.', { enrollmentId });
  }

  await assertSessionWritable(db, enrollment.trainingSessionId, {
    id: actorId,
    role: actorRole,
  });

  const currentStatus = (enrollment.status ?? 'PENDING') as EnrollmentStatusLike;

  if (!isTransitionAllowed(currentStatus, newStatus)) {
    throw conflictError(
      `Transition de statut non autorisée : ${currentStatus} → ${newStatus}.`,
      { currentStatus, targetStatus: newStatus, enrollmentId },
    );
  }

  const updated = await db.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status: newStatus,
      statusChangedAt: new Date(),
      statusChangedBy: actorId,
    },
  });

  await logAudit(db, {
    actorId,
    action: ACTION_ENROLLMENT_STATUS_CHANGED,
    entityType: 'Enrollment',
    entityId: enrollmentId,
    oldValue: { status: currentStatus, reason },
    newValue: { status: newStatus, reason },
  });

  return {
    id: updated.id,
    status: newStatus,
    previousStatus: currentStatus,
    statusChangedAt: updated.statusChangedAt ?? new Date(),
    statusChangedBy: updated.statusChangedBy ?? actorId,
    enrollmentId,
  };
}
