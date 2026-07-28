import { readJson, route } from '@/lib/api/handler';
import { assignGroupSchema } from '@/lib/validation/schemas';
import { assignGroup } from '@/services/enrollment';

/** Affectation de groupe en masse depuis la grille des inscrits. */
export const POST = route<{ id: string }>(
  { resource: 'Enrollment', access: 'write' },
  async ({ db, params, request }) => {
    const input = await readJson(request, assignGroupSchema);
    return assignGroup(db, params.id, input.enrollmentIds, input.groupType, input.groupId);
  },
);
