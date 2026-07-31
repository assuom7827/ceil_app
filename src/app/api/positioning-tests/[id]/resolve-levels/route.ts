import { route } from '@/lib/api/handler';
import { resolveLevels } from '@/services/positioning';

/** Applique le niveau résolu de chaque note à `Enrollment.assignedLevel`. */
export const POST = route<{ id: string }>(
  { resource: 'PositioningScore', access: 'write' },
  ({ db, params, actor }) => resolveLevels(db, params.id, actor.id),
);
