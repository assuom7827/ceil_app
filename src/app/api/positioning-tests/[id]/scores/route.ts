import { readJson, route } from '@/lib/api/handler';
import { positioningBulkSchema } from '@/lib/validation/schemas';
import { withTransaction } from '@/services/db';
import { getPositioningRows, upsertPositioningScore } from '@/services/positioning';

/** Lignes du test avec `total` et `resolvedLevel` DÉRIVÉS. */
export const GET = route<{ id: string }>(
  { resource: 'PositioningScore', access: 'read' },
  ({ db, params }) => getPositioningRows(db, params.id),
);

/** Enregistrement en masse depuis la grille de positionnement. */
export const PUT = route<{ id: string }>(
  { resource: 'PositioningScore', access: 'write' },
  async ({ db, params, request, actor }) => {
    const { scores } = await readJson(request, positioningBulkSchema);

    return withTransaction(db, async (tx) => {
      for (const { enrollmentId, ...values } of scores) {
        await upsertPositioningScore(tx, params.id, enrollmentId, values, actor.id);
      }
      return { updated: scores.length };
    });
  },
);
