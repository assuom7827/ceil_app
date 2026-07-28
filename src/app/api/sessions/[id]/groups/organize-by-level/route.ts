import { route } from '@/lib/api/handler';
import { organizeByLevelSchema } from '@/lib/validation/schemas';
import { getSessionGroups, organizeGroupsByLevel } from '@/services/groups';

/**
 * Ouvre les groupes de session niveau par niveau, dimensionnés sur l'effectif :
 * 60 A1 avec des salles de 25 donnent 3 groupes, 10 B2 en donnent 1.
 * À lancer APRÈS le test de positionnement.
 */
export const POST = route<{ id: string }>(
  { resource: 'StudentGroup', access: 'write' },
  async ({ db, params, url }) => {
    const capacityParam = url.searchParams.get('capacity');
    const { capacity } = organizeByLevelSchema.parse(
      capacityParam === null ? {} : { capacity: capacityParam },
    );
    return organizeGroupsByLevel(db, params.id, { capacity });
  },
);

/** Groupes réels de la session, avec effectif et niveau visé. */
export const GET = route<{ id: string }>(
  { resource: 'StudentGroup', access: 'read' },
  ({ db, params }) => getSessionGroups(db, params.id),
);
