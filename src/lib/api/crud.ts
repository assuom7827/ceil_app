/**
 * Fabrique de routes CRUD.
 *
 * Les référentiels et le catalogue partagent exactement le même comportement :
 * liste paginée triable et cherchable, création, détail, mise à jour,
 * suppression. Le décrire treize fois inviterait treize divergences ; il est
 * décrit une fois ici et chaque route se réduit à sa configuration.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { notFoundError } from '@/services/errors';
import type { Actor, Resource } from '@/services/rbac';
import { route, readJson, type HandlerContext } from './handler';
import { orderByFor, paginate, parseListQuery, searchFilter, skipTake } from './pagination';

/**
 * Surface minimale d'un délégué Prisma. Déclarée en syntaxe de méthode : la
 * bivariance des paramètres permet d'y brancher n'importe quel délégué généré
 * sans recourir à `any`.
 */
export interface CrudDelegate {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown>;
  count(args?: unknown): Promise<number>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
}

export interface CrudConfig<TInput> {
  resource: Resource;
  /** Délégué Prisma correspondant, ex. `db.faculty`. */
  delegate: (db: HandlerContext<unknown>['db']) => CrudDelegate;
  schema: { parse: (value: unknown) => TInput };
  /** Schéma de mise à jour ; à défaut, `schema` est réutilisé. */
  updateSchema?: { parse: (value: unknown) => TInput };
  /** Champs texte interrogés par `?q=`. */
  searchable?: readonly string[];
  /** Champs acceptés par `?sort=`. */
  sortable?: readonly string[];
  defaultOrderBy?: Record<string, 'asc' | 'desc'>;
  /** Relations chargées en liste et en détail. */
  include?: Record<string, unknown>;
  /** Traduit le corps validé en `data` Prisma (relations M2N, connexions…). */
  toCreateData?: (input: TInput) => Record<string, unknown>;
  toUpdateData?: (input: TInput) => Record<string, unknown>;
  /** L'entité porte-t-elle un champ `disabled` ? */
  softDisable?: boolean;
  /**
   * Filtre additionnel appliqué aux listes, après le filtre `disabled` par
   * défaut. Reçoit l'acteur courant et la requête parsée. Les clés retournées
   * écrrasent les filtres précédents, ce qui permet de remplacer le filtre
   * `disabled` par un comportement basé sur le rôle.
   */
  listFilter?: (actor: Actor, query: ReturnType<typeof parseListQuery>) => Record<string, unknown>;
  /**
   * Invariant à rétablir après écriture (ex. « un seul défaut actif »).
   * Reçoit l'enregistrement produit et renvoie sa version définitive, afin que
   * la réponse ne présente jamais un état déjà corrigé en base.
   */
  afterWrite?: (db: HandlerContext<unknown>['db'], record: unknown) => Promise<unknown>;
}

function dataFrom<TInput>(
  input: TInput,
  transform: ((input: TInput) => Record<string, unknown>) | undefined,
): Record<string, unknown> {
  return transform ? transform(input) : (input as Record<string, unknown>);
}

/** `GET /api/<ressource>` et `POST /api/<ressource>`. */
export function collectionRoutes<TInput>(config: CrudConfig<TInput>) {
  const GET = route({ resource: config.resource, access: 'read' }, async ({ db, url, actor }) => {
    const query = parseListQuery(url);
    const delegate = config.delegate(db);

    const where = {
      ...(config.softDisable !== false && !query.includeDisabled ? { disabled: false } : {}),
      ...(config.listFilter ? config.listFilter(actor as Actor, query) : {}),
      ...(searchFilter(query, config.searchable ?? []) ?? {}),
    };

    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        ...skipTake(query),
        orderBy: orderByFor(query, config.sortable ?? [], config.defaultOrderBy ?? { id: 'asc' }),
        ...(config.include ? { include: config.include } : {}),
      }),
      delegate.count({ where }),
    ]);

    return paginate(data, total, query);
  });

  const POST = route({ resource: config.resource, access: 'write' }, async ({ db, request }) => {
    const input = await readJson(request, config.schema);
    const created = await config
      .delegate(db)
      .create({ data: dataFrom(input, config.toCreateData) });
    const settled = config.afterWrite ? await config.afterWrite(db, created) : created;
    return NextResponse.json(settled, { status: 201 });
  });

  return { GET, POST };
}

/** `GET`, `PATCH` et `DELETE` sur `/api/<ressource>/[id]`. */
export function itemRoutes<TInput>(config: CrudConfig<TInput>) {
  const GET = route<{ id: string }>(
    { resource: config.resource, access: 'read' },
    async ({ db, params }) => {
      const found = await config.delegate(db).findUnique({
        where: { id: params.id },
        ...(config.include ? { include: config.include } : {}),
      });
      if (!found) throw notFoundError('Élément introuvable.', { id: params.id });
      return found;
    },
  );

  const PATCH = route<{ id: string }>(
    { resource: config.resource, access: 'write' },
    async ({ db, params, request }) => {
      const schema = config.updateSchema ?? config.schema;
      const input = await readJson(request, schema);
      const updated = await config.delegate(db).update({
        where: { id: params.id },
        data: dataFrom(input, config.toUpdateData ?? config.toCreateData),
        ...(config.include ? { include: config.include } : {}),
      });
      return config.afterWrite ? config.afterWrite(db, updated) : updated;
    },
  );

  const DELETE = route<{ id: string }>(
    { resource: config.resource, access: 'write' },
    async ({ db, params }) => {
      await config.delegate(db).delete({ where: { id: params.id } });
      return undefined; // 204
    },
  );

  return { GET, PATCH, DELETE };
}

/** Signature d'un Route Handler Next, pour typer les ré-exports. */
export type RouteHandler = (
  request: NextRequest,
  segment: { params: Promise<never> },
) => Promise<Response>;
