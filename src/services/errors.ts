/**
 * Erreurs métier — un type unique, porteur du code HTTP.
 *
 * Les services lèvent ces erreurs ; le wrapper de l'API (étape 4) les traduit
 * en réponses `{ error, message, details? }` avec le bon statut. Aucun service
 * ne manipule d'objet `Response` : la couche métier reste testable seule.
 */

export type ServiceErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'LOCKED'
  | 'CONFLICT'
  | 'UNPROCESSABLE';

const STATUS_BY_CODE: Record<ServiceErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  /** Entité verrouillée : conflit d'état, pas une erreur de saisie. */
  LOCKED: 409,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
};

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ServiceErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

export const validationError = (message: string, details?: unknown) =>
  new ServiceError('VALIDATION', message, details);

export const unauthorizedError = (message = 'Authentification requise.') =>
  new ServiceError('UNAUTHORIZED', message);

export const forbiddenError = (message: string, details?: unknown) =>
  new ServiceError('FORBIDDEN', message, details);

export const notFoundError = (message: string, details?: unknown) =>
  new ServiceError('NOT_FOUND', message, details);

/** 409 — l'entité est verrouillée, toute modification est refusée. */
export const lockedError = (message: string, details?: unknown) =>
  new ServiceError('LOCKED', message, details);

export const conflictError = (message: string, details?: unknown) =>
  new ServiceError('CONFLICT', message, details);

export const unprocessableError = (message: string, details?: unknown) =>
  new ServiceError('UNPROCESSABLE', message, details);
