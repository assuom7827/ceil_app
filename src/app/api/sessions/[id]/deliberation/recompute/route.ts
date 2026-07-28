import { route } from '@/lib/api/handler';
import { computeAdmission } from '@/services/deliberation';

/** Calcul PUR : rien n'est persisté, le statut reste dérivé. */
export const POST = route<{ id: string }>(
  { resource: 'DeliberationEntry', access: 'read' },
  ({ db, params }) => computeAdmission(db, params.id),
);
