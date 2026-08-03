import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireActor } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { deriveSessionTitle, deriveYears } from '@/services/derive';
import { canWrite, canManageSessions } from '@/services/rbac';
import { getUserDelegatedSessions } from '@/services/delegation';
import { NewSessionButton } from './new-session-button';
import { SessionActions } from './session-actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('nav.sessions') };
}

export default async function SessionsPage() {
  const actor = await requireActor();
  const t = await getTranslations();
  const canManage = canManageSessions(actor.role);

  const where = canManage ? { disabled: false } : { disabled: false, agents: { some: { userId: actor.id } } };

  const [sessions, delegatedSessionIds] = await Promise.all([
    prisma.trainingSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        state: true,
        mode: true,
        status: true,
        academicYear: true,
        dateFrom: true,
        dateTo: true,
        admissionThreshold: true,
        training: { select: { frName: true, arName: true } },
        trainingLevel: { select: { name: true } },
        _count: { select: { enrollments: true, groups: true } },
      },
    }),
    canManage ? Promise.resolve<string[]>([]) : getUserDelegatedSessions(prisma, actor.id),
  ]);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('sessions.title')}</h1>
          <p className="text-muted-foreground">{t('sessions.subtitle')}</p>
        </div>
        <NewSessionButton canWrite={canWrite(actor, 'TrainingSession')} />
       </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('sessions.count', { count: sessions.length })}</CardTitle>
          <CardDescription>{t('sessions.derivedNote')}</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('sessions.empty')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('sessions.colSession')}</TableHead>
                  <TableHead>{t('sessions.colYears')}</TableHead>
                  <TableHead>{t('sessions.colMode')}</TableHead>
                  <TableHead>{t('sessions.colStatus')}</TableHead>
                  <TableHead>{t('sessions.colState')}</TableHead>
                  <TableHead className="text-end">{t('sessions.colThreshold')}</TableHead>
                  <TableHead className="text-end">{t('sessions.colEnrollments')}</TableHead>
                  <TableHead className="text-end">{t('sessions.colGroups')}</TableHead>
                  <TableHead className="text-end">{t('sessions.colWorkspace')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const years = deriveYears(session);
                  return (
                    <TableRow key={session.id}>
                      <TableCell className="py-3 font-medium">
                        {deriveSessionTitle(session) || t('session.noTitle')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {years.yearFrom ? `${years.yearFrom} → ${years.yearTo ?? '…'}` : '—'}
                      </TableCell>
                      <TableCell>
                        {session.mode
                          ? t(`session.mode.${session.mode.toLowerCase()}`)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {session.status
                          ? t(`session.status.${session.status.toLowerCase()}`)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={session.state === 'OPEN' ? 'secondary' : 'outline'}>
                            {session.state === 'OPEN'
                              ? t('session.state.open')
                              : t('session.state.locked')}
                          </Badge>
                          {!canManage && delegatedSessionIds.includes(session.id) ? (
                            <Badge variant="outline">{t('delegation.badge')}</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {session.admissionThreshold}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {session._count.enrollments}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {session._count.groups}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/sessions/${session.id}/workspace`}>
                              {t('sessions.workspaceLink')}
                            </Link>
                          </Button>
                          {canManage ? (
                            <SessionActions
                              sessionId={session.id}
                              role={actor.role}
                              canWrite={canManage}
                              enrollmentCount={session._count.enrollments}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
