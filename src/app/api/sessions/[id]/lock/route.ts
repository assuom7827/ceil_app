import { route } from '@/lib/api/handler';
import { lockSession } from '@/services/locking';

export const POST = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'write' },
  ({ db, params, actor }) => lockSession(db, params.id, actor.id),
);
