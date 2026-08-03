import { route } from '@/lib/api/handler';
import { computeAdmission } from '@/services/deliberation';
import { deriveSessionTitle } from '@/services/derive';
import { canManageSessions } from '@/services/rbac';
import { getUserDelegatedSessions } from '@/services/delegation';

/** KPIs du tableau de bord. Les admis sont DÉRIVÉS, jamais lus dans une colonne. */
export const GET = route({ resource: 'TrainingSession', access: 'read' }, async ({ db, actor }) => {
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

  const delegatedSessionIds = canManageSessions(actor.role)
    ? new Set<string>()
    : new Set(await getUserDelegatedSessions(db, actor.id));

  const filteredSessions = recentSessions.filter((session) =>
    canManageSessions(actor.role) || delegatedSessionIds.has(session.id),
  );

  // Le nombre d'admis n'existe dans aucune colonne : il se calcule.
  const admissions = await Promise.all(
    filteredSessions.map(async (session) => ({
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
