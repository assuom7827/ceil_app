import { readUploadedFile, route } from '@/lib/api/handler';
import { importPositioningScores, parseTabular } from '@/services/imports';

/** Import des 2 notes écrites (E.E, C.E), rapprochées par matricule. */
export const POST = route<{ id: string }>(
  { resource: 'PositioningScore', access: 'write' },
  async ({ db, params, request }) => {
    const file = await readUploadedFile(request);
    return importPositioningScores(db, params.id, parseTabular(file));
  },
);
