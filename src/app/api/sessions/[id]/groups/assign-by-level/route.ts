import { route } from '@/lib/api/handler';
import { assignGroupsByLevel } from '@/services/groups';

/** Range chaque inscrit dans un groupe de SON niveau (après positionnement). */
export const POST = route<{ id: string }>(
  { resource: 'StudentGroup', access: 'write' },
  async ({ db, params, actor }) => {
    return assignGroupsByLevel(db, params.id, actor.id, actor.role);
  },
);
