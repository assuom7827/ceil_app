import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireActor } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { computeAdmission } from '@/services/deliberation';
import { deriveSessionTitle } from '@/services/derive';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('nav.dashboard') };
}

/** Les compteurs viennent des mêmes services que l'API : aucun calcul parallèle. */
async function loadStats(noTitle: string) {
  const [participants, openSessions, lockedSessions, confirmedReceipts, recent] = await Promise.all(
    [
      prisma.participant.count(),
      prisma.trainingSession.count({ where: { state: 'OPEN', disabled: false } }),
      prisma.trainingSession.count({ where: { state: 'LOCKED', disabled: false } }),
      prisma.paymentReceipt.count({ where: { state: 'CONFIRMED', disabled: false } }),
      prisma.trainingSession.findMany({
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
    ],
  );

  const sessions = await Promise.all(
    recent.map(async (session) => ({
      id: session.id,
      title: deriveSessionTitle(session) || noTitle,
      state: session.state,
      enrollments: session._count.enrollments,
      admission: await computeAdmission(prisma, session.id),
    })),
  );

  return { participants, openSessions, lockedSessions, confirmedReceipts, sessions };
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  await requireActor();
  const t = await getTranslations();
  const stats = await loadStats(t('session.noTitle'));

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('nav.dashboard')}</h1>
        <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t('nav.participants')} value={stats.participants} />
        <Kpi label={t('dashboard.openSessions')} value={stats.openSessions} />
        <Kpi label={t('dashboard.lockedSessions')} value={stats.lockedSessions} />
        <Kpi label={t('dashboard.confirmedReceipts')} value={stats.confirmedReceipts} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentSessions')}</CardTitle>
          <CardDescription>{t('dashboard.recentDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-start font-medium">{t('dashboard.colSession')}</th>
                    <th className="py-2 text-start font-medium">{t('dashboard.colState')}</th>
                    <th className="py-2 text-end font-medium">{t('dashboard.colEnrollments')}</th>
                    <th className="py-2 text-end font-medium">{t('scores.admitted')}</th>
                    <th className="py-2 text-end font-medium">{t('scores.refused')}</th>
                    <th className="py-2 text-end font-medium">{t('dashboard.colPending')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sessions.map((session) => (
                    <tr key={session.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{session.title}</td>
                      <td className="py-2">
                        <Badge variant={session.state === 'OPEN' ? 'secondary' : 'outline'}>
                          {session.state === 'OPEN'
                            ? t('session.state.open')
                            : t('session.state.locked')}
                        </Badge>
                      </td>
                      <td className="py-2 text-end tabular-nums">{session.enrollments}</td>
                      <td className="py-2 text-end tabular-nums">{session.admission.admitted}</td>
                      <td className="py-2 text-end tabular-nums">{session.admission.refused}</td>
                      <td className="py-2 text-end tabular-nums text-muted-foreground">
                        {session.admission.pending}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
