import { route } from '@/lib/api/handler';
import { unlockPositioningTest } from '@/services/locking';

export const POST = route<{ id: string }>(
  { resource: 'PositioningTest', access: 'write' },
  ({ db, params }) => unlockPositioningTest(db, params.id),
);
