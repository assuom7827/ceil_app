/**
 * RBAC applicatif — vérifié systématiquement CÔTÉ SERVEUR.
 *
 * L'UI masque les actions interdites, mais c'est ici que la règle s'applique :
 * une requête forgée doit être refusée même si le bouton n'existe pas à l'écran.
 */
import { forbiddenError, unauthorizedError } from './errors';
import type { Db } from './db';

export type Role = 'MANAGER' | 'USER' | 'ADMIN';

export type Resource =
  | 'Faculty'
  | 'Speciality'
  | 'Teacher'
  | 'StudentCategory'
  | 'TrainingLevel'
  | 'DiplomaModel'
  | 'Training'
  | 'Participant'
  | 'TrainingSession'
  | 'StudentGroup'
  | 'Enrollment'
  | 'PositioningTest'
  | 'PositioningScore'
  | 'DeliberationEntry'
  | 'PaymentReceipt'
  | 'AuditLog'
  | 'User';

/** Rôles disposant du CRUD complet sur toutes les ressources. */
const FULL_ACCESS_ROLES: readonly Role[] = ['MANAGER', 'ADMIN'];

/** Ressources que le rôle `USER` peut écrire.
 *
 *  Toute ressource hors de cette liste est en lecture seule pour lui.
 *  Cette liste blanche remplace l'ancienne liste noire `USER_READ_ONLY_RESOURCES`,
 *  qui autorisait implicitement l'écriture sur 13 ressources métier.
 */
const USER_WRITABLE_RESOURCES: readonly Resource[] = [
  'Enrollment',
  'PositioningScore',
  'DeliberationEntry',
  'PaymentReceipt',
];

/** Ressources réservées à l'administration des comptes. */
const ADMIN_ONLY_RESOURCES: readonly Resource[] = ['User'];

export interface Actor {
  id: string;
  role: Role;
}

export function hasFullAccess(role: Role): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}

export function isAdmin(role: Role): boolean {
  return role === 'ADMIN';
}

/** MANAGER et ADMIN gèrent la configuration — pas les utilisateurs classiques. */
export function canManageSessions(role: Role): boolean {
  return hasFullAccess(role);
}

/** Toute ressource métier est lisible par un utilisateur authentifié. */
export function canRead(actor: Actor | null | undefined, resource: Resource): boolean {
  if (!actor) return false;
  if (ADMIN_ONLY_RESOURCES.includes(resource)) return actor.role === 'ADMIN';
  if (resource === 'AuditLog') return hasFullAccess(actor.role);
  return true;
}

export function canWrite(actor: Actor | null | undefined, resource: Resource): boolean {
  if (!actor) return false;
  if (ADMIN_ONLY_RESOURCES.includes(resource)) return actor.role === 'ADMIN';
  if (hasFullAccess(actor.role)) return true;
  return USER_WRITABLE_RESOURCES.includes(resource);
}

export function assertAuthenticated(actor: Actor | null | undefined): asserts actor is Actor {
  if (!actor) throw unauthorizedError();
}

export function assertCanRead(actor: Actor | null | undefined, resource: Resource): void {
  assertAuthenticated(actor);
  if (!canRead(actor, resource)) {
    throw forbiddenError(`Lecture non autorisée sur ${resource} pour le rôle ${actor.role}.`, {
      resource,
      role: actor.role,
    });
  }
}

export function assertCanWrite(actor: Actor | null | undefined, resource: Resource): void {
  assertAuthenticated(actor);
  if (!canWrite(actor, resource)) {
    throw forbiddenError(`Modification non autorisée sur ${resource} pour le rôle ${actor.role}.`, {
      resource,
      role: actor.role,
    });
  }
}

export async function canReadSession(
  actor: Actor | null | undefined,
  db: Db,
  trainingSessionId: string,
): Promise<boolean> {
  if (!actor) return false;
  if (hasFullAccess(actor.role)) return true;

  const delegation = await db.sessionAgent.findFirst({
    where: { trainingSessionId, userId: actor.id },
    select: { id: true },
  });
  return !!delegation;
}

export async function canWriteSession(
  actor: Actor | null | undefined,
  db: Db,
  trainingSessionId: string,
): Promise<boolean> {
  if (!actor) return false;
  if (hasFullAccess(actor.role)) return true;
  return canReadSession(actor, db, trainingSessionId);
}

export async function assertCanReadSession(
  actor: Actor | null | undefined,
  db: Db,
  trainingSessionId: string,
): Promise<void> {
  if (!canReadSession(actor, db, trainingSessionId)) {
    throw forbiddenError("Vous n'avez pas accès à cette session.", {
      trainingSessionId,
      role: actor?.role,
    });
  }
}

export async function assertCanWriteSession(
  actor: Actor | null | undefined,
  db: Db,
  trainingSessionId: string,
): Promise<void> {
  if (!(await canWriteSession(actor, db, trainingSessionId))) {
    throw forbiddenError("Vous n'avez pas les droits d'écriture sur cette session.", {
      trainingSessionId,
      role: actor?.role,
    });
  }
}
