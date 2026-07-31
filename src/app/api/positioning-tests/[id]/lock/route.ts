import { route } from '@/lib/api/handler';
import { lockPositioningTest } from '@/services/locking';

export const POST = route<{ id: string }>(
  { resource: 'PositioningTest', access: 'write' },
  ({ db, params, actor }) => lockPositioningTest(db, params.id, actor.id),
);
