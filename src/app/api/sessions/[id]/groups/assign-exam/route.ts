import { route } from '@/lib/api/handler';
import { assignExamGroups } from '@/services/groups';

export const POST = route<{ id: string }>(
  { resource: 'StudentGroup', access: 'write' },
  ({ db, params }) => assignExamGroups(db, params.id),
);
