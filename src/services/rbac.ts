/**
 * RBAC applicatif — vérifié systématiquement CÔTÉ SERVEUR.
 *
 * L'UI masque les actions interdites, mais c'est ici que la règle s'applique :
 * une requête forgée doit être refusée même si le bouton n'existe pas à l'écran.
 */
import { forbiddenError, unauthorizedError } from './errors';

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
  | 'User';

/** Rôles disposant du CRUD complet sur toutes les ressources. */
const FULL_ACCESS_ROLES: readonly Role[] = ['MANAGER', 'ADMIN'];

/** Ressources en LECTURE SEULE pour le rôle `USER`. */
export const USER_READ_ONLY_RESOURCES: readonly Resource[] = [
  'Training',
  'TrainingLevel',
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

/** Toute ressource métier est lisible par un utilisateur authentifié. */
export function canRead(actor: Actor | null | undefined, resource: Resource): boolean {
  if (!actor) return false;
  if (ADMIN_ONLY_RESOURCES.includes(resource)) return actor.role === 'ADMIN';
  return true;
}

export function canWrite(actor: Actor | null | undefined, resource: Resource): boolean {
  if (!actor) return false;
  if (ADMIN_ONLY_RESOURCES.includes(resource)) return actor.role === 'ADMIN';
  if (hasFullAccess(actor.role)) return true;
  return !USER_READ_ONLY_RESOURCES.includes(resource);
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
