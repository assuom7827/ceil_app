import { route } from '@/lib/api/handler';
import { organizeGroupsSchema } from '@/lib/validation/schemas';
import { organizeGroups } from '@/services/groups';

/**
 * Instancie les groupes réels depuis les gabarits, sans notion de niveau.
 * Convient aux groupes d'EXAMEN ; pour les groupes de session d'une session
 * multi-niveaux, voir `organize-by-level`.
 */
export const POST = route<{ id: string }>(
  { resource: 'StudentGroup', access: 'write' },
  ({ db, params, url }) => {
    const { type } = organizeGroupsSchema.parse({
      type: url.searchParams.get('type') ?? undefined,
    });
    return organizeGroups(db, params.id, type);
  },
);
