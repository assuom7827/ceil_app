import { route } from '@/lib/api/handler';
import { assignExamGroups } from '@/services/groups';

export const POST = route<{ id: string }>(
  { resource: 'StudentGroup', access: 'write' },
  async ({ db, params, actor }) => {
    return assignExamGroups(db, params.id, actor.id, actor.role);
  },
);
