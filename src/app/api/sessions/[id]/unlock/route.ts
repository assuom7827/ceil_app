import { route } from '@/lib/api/handler';
import { unlockSession } from '@/services/locking';

export const POST = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'write' },
  ({ db, params }) => unlockSession(db, params.id),
);
