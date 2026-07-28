import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PER_PAGE,
  orderByFor,
  paginate,
  parseListQuery,
  searchFilter,
  skipTake,
} from '@/lib/api/pagination';

function query(search: string) {
  return parseListQuery(new URL(`http://localhost/api/x${search}`));
}

describe('paramètres de liste', () => {
  it('applique les valeurs par défaut', () => {
    expect(query('')).toMatchObject({
      page: 1,
      perPage: DEFAULT_PER_PAGE,
      order: 'asc',
      includeDisabled: false,
    });
  });

  it('masque les éléments désactivés sauf demande explicite', () => {
    expect(query('?includeDisabled=true').includeDisabled).toBe(true);
    expect(query('?includeDisabled=false').includeDisabled).toBe(false);
  });

  it('refuse une pagination hors bornes', () => {
    expect(() => query('?page=0')).toThrow();
    expect(() => query('?perPage=5000')).toThrow();
  });

  it('calcule le décalage', () => {
    expect(skipTake(query('?page=3&perPage=10'))).toEqual({ skip: 20, take: 10 });
  });

  it('compte les pages, minimum une même à vide', () => {
    expect(paginate([], 0, query('')).meta.totalPages).toBe(1);
    expect(paginate([], 51, query('?perPage=25')).meta.totalPages).toBe(3);
  });

  /** Un champ de tri venu de l'URL ne doit jamais atteindre Prisma tel quel. */
  it('ignore un champ de tri non autorisé', () => {
    const allowed = ['name'];
    const fallback = { createdAt: 'desc' as const };

    expect(orderByFor(query('?sort=name&order=desc'), allowed, fallback)).toEqual({ name: 'desc' });
    expect(orderByFor(query('?sort=passwordHash'), allowed, fallback)).toEqual(fallback);
    expect(orderByFor(query(''), allowed, fallback)).toEqual(fallback);
  });

  it('construit la recherche sur les champs déclarés', () => {
    expect(searchFilter(query('?q=ben'), ['name', 'email'])).toEqual({
      OR: [
        { name: { contains: 'ben', mode: 'insensitive' } },
        { email: { contains: 'ben', mode: 'insensitive' } },
      ],
    });
  });

  it('n’ajoute aucun filtre sans terme de recherche', () => {
    expect(searchFilter(query(''), ['name'])).toBeUndefined();
    expect(searchFilter(query('?q=ben'), [])).toBeUndefined();
  });
});
