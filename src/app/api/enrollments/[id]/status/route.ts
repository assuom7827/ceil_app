import { route, readJson } from '@/lib/api/handler';
import { enrollmentStatusChangeSchema } from '@/lib/validation/schemas';
import { transitionEnrollmentStatus } from '@/services/enrollmentStatus';

/**
 * Transition de statut d'une inscription.
 *
 * La machine à états (ALLOWED_TRANSITIONS) et le contrôle de délégation
 * (assertSessionWritable) sont appliqués dans le service. Seuls les agents
 * délégués (ou MANAGER/ADMIN) peuvent appeler cette route.
 */
export const POST = route<{ id: string }>(
  { resource: 'Enrollment', access: 'write' },
  async ({ db, params, request, actor }) => {
    const data = await readJson(request, enrollmentStatusChangeSchema);
    return transitionEnrollmentStatus(
      db,
      params.id,
      data.status,
      actor.id,
      actor.role,
      data.reason ?? undefined,
    );
  },
);
