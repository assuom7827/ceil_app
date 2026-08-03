import { route } from '@/lib/api/handler';
import { computeAdmission } from '@/services/deliberation';
import { assertSessionAccess } from '@/services/locking';

export const POST = route<{ id: string }>(
  { resource: 'DeliberationEntry', access: 'read' },
  async ({ db, params, actor }) => {
    await assertSessionAccess(db, params.id, actor);
    return computeAdmission(db, params.id);
  },
);
