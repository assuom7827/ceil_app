import { route, readJson } from '@/lib/api/handler';
import { deliberationBulkSchema } from '@/lib/validation/schemas';
import { getDeliberation, upsertDeliberationEntry } from '@/services/deliberation';
import { withTransaction } from '@/services/db';

/** Lignes de la session avec `total` et `status` DÉRIVÉS (jamais stockés). */
export const GET = route<{ id: string }>(
  { resource: 'DeliberationEntry', access: 'read' },
  ({ db, params }) => getDeliberation(db, params.id),
);

/**
 * Enregistrement en masse depuis la grille (bouton « Enregistrer tout » ou
 * collage depuis Excel). Transactionnel : une ligne en erreur annule le lot,
 * ce qui évite un état à moitié écrit après un collage malformé.
 */
export const PUT = route<{ id: string }>(
  { resource: 'DeliberationEntry', access: 'write' },
  async ({ db, params, request }) => {
    const { entries } = await readJson(request, deliberationBulkSchema);

    return withTransaction(db, async (tx) => {
      for (const { enrollmentId, ...values } of entries) {
        await upsertDeliberationEntry(tx, params.id, enrollmentId, values);
      }
      return { updated: entries.length };
    });
  },
);
