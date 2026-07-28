import { route } from '@/lib/api/handler';
import { lockPositioningTest } from '@/services/locking';

export const POST = route<{ id: string }>(
  { resource: 'PositioningTest', access: 'write' },
  ({ db, params }) => lockPositioningTest(db, params.id),
);
