/**
 * Pagination, tri et recherche — lecture des paramètres de requête.
 * Fonctions pures : testables sans serveur.
 */
import { z } from 'zod';

export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 200;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
  sort: z.string().trim().min(1).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().trim().min(1).optional(),
  /** `false` masque les entités désactivées (comportement par défaut). */
  includeDisabled: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function parseListQuery(url: URL): ListQuery {
  return listQuerySchema.parse(Object.fromEntries(url.searchParams));
}

export interface Page<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export function paginate<T>(data: T[], total: number, query: ListQuery): Page<T> {
  return {
    data,
    meta: {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    },
  };
}

export function skipTake(query: ListQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.perPage, take: query.perPage };
}

/**
 * Clause `orderBy` restreinte aux colonnes explicitement autorisées : un champ
 * de tri arbitraire venu de l'URL ne doit pas atteindre Prisma.
 */
export function orderByFor(
  query: ListQuery,
  allowed: readonly string[],
  fallback: Record<string, 'asc' | 'desc'>,
): Record<string, 'asc' | 'desc'> {
  if (query.sort && allowed.includes(query.sort)) {
    return { [query.sort]: query.order };
  }
  return fallback;
}

/** Recherche insensible à la casse sur les champs texte autorisés. */
export function searchFilter(
  query: ListQuery,
  fields: readonly string[],
): { OR: Array<Record<string, { contains: string; mode: 'insensitive' }>> } | undefined {
  if (!query.q || fields.length === 0) return undefined;
  return {
    OR: fields.map((field) => ({ [field]: { contains: query.q!, mode: 'insensitive' as const } })),
  };
}
