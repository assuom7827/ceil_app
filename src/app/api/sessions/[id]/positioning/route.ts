import { route } from '@/lib/api/handler';
import { getSessionPositioning } from '@/services/positioning';
import { notFoundError } from '@/services/errors';

/**
 * Grille de positionnement de la session.
 *
 * Sans `testId`, renvoie les tests disponibles pour la formation de la session,
 * afin que l'onglet puisse en proposer le choix avant toute saisie.
 */
export const GET = route<{ id: string }>(
  { resource: 'PositioningScore', access: 'read' },
  async ({ db, params, url }) => {
    const testId = url.searchParams.get('testId');

    const session = await db.trainingSession.findUnique({
      where: { id: params.id },
      select: { trainingId: true },
    });
    if (!session) throw notFoundError('Session de formation introuvable.', { id: params.id });

    if (!testId) {
      const tests = await db.positioningTest.findMany({
        where: { trainingId: session.trainingId, disabled: false },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, date: true, state: true },
      });
      return { tests, rows: [] };
    }

    return getSessionPositioning(db, params.id, testId);
  },
);
