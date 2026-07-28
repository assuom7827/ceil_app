/**
 * Traduction des erreurs en réponses HTTP — point de passage UNIQUE.
 *
 * Toute réponse d'erreur de l'API a la même forme : `{ error, message, details? }`.
 * Aucun Route Handler ne construit d'erreur lui-même : il lève, le wrapper traduit.
 */
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ServiceError, type ServiceErrorCode } from '@/services/errors';

export interface ApiErrorBody {
  error: ServiceErrorCode | 'INTERNAL';
  message: string;
  details?: unknown;
}

function body(
  error: ApiErrorBody['error'],
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    details === undefined ? { error, message } : { error, message, details },
    { status },
  );
}

/** Champs fautifs d'une erreur Zod, sous une forme exploitable par un formulaire. */
function zodDetails(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Erreurs Prisma remontées jusqu'ici : ce sont des conflits de données réels,
 * pas des bugs. On les traduit plutôt que de renvoyer un 500 opaque.
 */
function fromPrisma(error: Prisma.PrismaClientKnownRequestError): NextResponse<ApiErrorBody> {
  switch (error.code) {
    case 'P2002': {
      const target = error.meta?.['target'];
      return body('CONFLICT', 'Cette valeur existe déjà.', 409, { fields: target });
    }
    case 'P2003':
      return body(
        'CONFLICT',
        'Élément référencé par d’autres données : suppression ou modification impossible.',
        409,
      );
    case 'P2025':
      return body('NOT_FOUND', 'Élément introuvable.', 404);
    default:
      return body('INTERNAL', 'Erreur de base de données.', 500, { code: error.code });
  }
}

export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ServiceError) {
    return body(error.code, error.message, error.status, error.details);
  }

  if (error instanceof ZodError) {
    return body('VALIDATION', 'Les données saisies sont invalides.', 400, zodDetails(error));
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return fromPrisma(error);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return body('VALIDATION', 'Requête invalide.', 400);
  }

  // Cas non prévu : on trace côté serveur sans exposer le détail au client.
  console.error('[api] erreur non gérée', error);
  return body('INTERNAL', 'Une erreur interne est survenue.', 500);
}
