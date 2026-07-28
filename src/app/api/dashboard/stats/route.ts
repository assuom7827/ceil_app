import { route } from '@/lib/api/handler';
import { computeAdmission } from '@/services/deliberation';
import { deriveSessionTitle } from '@/services/derive';

/** KPIs du tableau de bord. Les admis sont DÉRIVÉS, jamais lus dans une colonne. */
export const GET = route({ resource: 'TrainingSession', access: 'read' }, async ({ db }) => {
  const [participants, openSessions, lockedSessions, confirmedReceipts, recentSessions] =
    await Promise.all([
      db.participant.count(),
      db.trainingSession.count({ where: { state: 'OPEN', disabled: false } }),
      db.trainingSession.count({ where: { state: 'LOCKED', disabled: false } }),
      db.paymentReceipt.count({ where: { state: 'CONFIRMED', disabled: false } }),
      db.trainingSession.findMany({
        where: { disabled: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          state: true,
          academicYear: true,
          training: { select: { frName: true, arName: true } },
          trainingLevel: { select: { name: true } },
          _count: { select: { enrollments: true } },
        },
      }),
    ]);

  // Le nombre d'admis n'existe dans aucune colonne : il se calcule.
  const admissions = await Promise.all(
    recentSessions.map(async (session) => ({
      id: session.id,
      title: deriveSessionTitle(session),
      state: session.state,
      enrollments: session._count.enrollments,
      ...(await computeAdmission(db, session.id)),
    })),
  );

  return {
    participants,
    sessions: { open: openSessions, locked: lockedSessions },
    confirmedReceipts,
    recentSessions: admissions,
  };
});
