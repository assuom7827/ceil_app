import { route } from '@/lib/api/handler';
import { organizeByLevelSchema } from '@/lib/validation/schemas';
import { getSessionGroups, organizeGroupsByLevel } from '@/services/groups';
import { assertSessionAccess } from '@/services/locking';

/**
 * Ouvre les groupes de session niveau par niveau, dimensionnés sur l'effectif :
 * 60 A1 avec des salles de 25 donnent 3 groupes, 10 B2 en donnent 1.
 * À lancer APRÈS le test de positionnement.
 */
export const POST = route<{ id: string }>(
  { resource: 'StudentGroup', access: 'write' },
  async ({ db, params, url, actor }) => {
    const capacityParam = url.searchParams.get('capacity');
    const { capacity } = organizeByLevelSchema.parse(
      capacityParam === null ? {} : { capacity: capacityParam },
    );
    return organizeGroupsByLevel(db, params.id, { capacity }, actor.id, actor.role);
  },
);

  /** Groupes réels de la session, avec effectif et niveau visé. */
  export const GET = route<{ id: string }>(
    { resource: 'StudentGroup', access: 'read' },
    async ({ db, params, actor }) => {
      await assertSessionAccess(db, params.id, actor);
      return getSessionGroups(db, params.id);
    },
  );
