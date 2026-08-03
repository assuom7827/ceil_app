import { readUploadedFile, route } from '@/lib/api/handler';
import { importEnrollments } from '@/services/imports';
import { parseTabular } from '@/services/imports';

/**
 * Import Excel/CSV : crée les participants absents puis les inscrit, en une
 * opération. Retourne un rapport détaillé (créés / rapprochés / inscrits /
 * ignorés / lignes en erreur avec leur numéro).
 */
export const POST = route<{ id: string }>(
  { resource: 'Enrollment', access: 'write' },
  async ({ db, params, request, actor }) => {
    const file = await readUploadedFile(request);
    return importEnrollments(db, params.id, parseTabular(file), actor.id, actor.role);
  },
);
