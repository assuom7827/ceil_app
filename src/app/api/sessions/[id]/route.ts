import { route, type HandlerContext } from '@/lib/api/handler';
import { itemRoutes } from '@/lib/api/crud';
import { trainingSessionCrud } from '@/lib/api/resources';
import { conflictError, notFoundError } from '@/services/errors';
import { assertSessionAccess } from '@/services/locking';

const base = itemRoutes(trainingSessionCrud);

export const GET = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'read' },
  async ({ db, params, actor }) => {
    await assertSessionAccess(db, params.id, actor);
    const found = await trainingSessionCrud.delegate(db).findUnique({
      where: { id: params.id },
      ...(trainingSessionCrud.include ? { include: trainingSessionCrud.include } : {}),
    });
    if (!found) throw notFoundError('Session de formation introuvable.', { id: params.id });
    return found;
  },
);

export const PATCH = base.PATCH;

export const DELETE = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'write' },
  async ({ db, params, actor }: HandlerContext<{ id: string }>) => {
    const session = await db.trainingSession.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!session) {
      throw notFoundError('Session de formation introuvable.', { id: params.id });
    }

    const enrollmentCount = await db.enrollment.count({
      where: { trainingSessionId: params.id },
    });

    if (actor.role === 'MANAGER' && enrollmentCount > 0) {
      throw conflictError(
        'Impossible de supprimer une session contenant des inscrits. Désinscrivez-les ou contactez un administrateur.',
        { enrollmentCount },
      );
    }

    await db.trainingSession.delete({ where: { id: params.id } });
  },
);
