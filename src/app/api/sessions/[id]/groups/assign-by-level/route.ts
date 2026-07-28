import { route } from '@/lib/api/handler';
import { assignGroupsByLevel } from '@/services/groups';

/** Range chaque inscrit dans un groupe de SON niveau (après positionnement). */
export const POST = route<{ id: string }>(
  { resource: 'StudentGroup', access: 'write' },
  ({ db, params }) => assignGroupsByLevel(db, params.id),
);
