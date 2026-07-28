import { readUploadedFile, route } from '@/lib/api/handler';
import { importDeliberationScores, parseTabular } from '@/services/imports';

/** Import des 4 notes (E.O, E.E, C.O, C.E), rapprochées par matricule. */
export const POST = route<{ id: string }>(
  { resource: 'DeliberationEntry', access: 'write' },
  async ({ db, params, request }) => {
    const file = await readUploadedFile(request);
    return importDeliberationScores(db, params.id, parseTabular(file));
  },
);
