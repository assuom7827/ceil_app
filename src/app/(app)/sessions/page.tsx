import type { Metadata } from 'next';
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
import { NewSessionButton } from './new-session-button';
import { SessionActions } from './session-actions';

export const metadata: Metadata = { title: 'Sessions de formation' };

export default async function SessionsPage() {
  const actor = await requireActor();
  const canManage = canManageSessions(actor.role);

  const sessions = await prisma.trainingSession.findMany({
    where: { disabled: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      state: true,
      academicYear: true,
      dateFrom: true,
      dateTo: true,
      admissionThreshold: true,
      training: { select: { frName: true, arName: true } },
      trainingLevel: { select: { name: true } },
      _count: { select: { enrollments: true, groups: true } },
    },
  });

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions de formation</h1>
          <p className="text-muted-foreground">
            Ouvrez l’espace de travail d’une session pour inscrire, noter et délibérer.
          </p>
        </div>
        <NewSessionButton canWrite={canWrite(actor, 'TrainingSession')} />
       </div>

      <Card>
        <CardHeader>
          <CardTitle>{sessions.length} session(s)</CardTitle>
          <CardDescription>
            Le titre est dérivé de la formation, du niveau et de l’année — il n’est pas stocké.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune session pour l’instant. Utilisez « Nouvelle session ».
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Années</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="text-end">Seuil</TableHead>
                  <TableHead className="text-end">Inscrits</TableHead>
                  <TableHead className="text-end">Groupes</TableHead>
                  <TableHead className="text-end">Espace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const years = deriveYears(session);
                  return (
                    <TableRow key={session.id}>
                      <TableCell className="py-3 font-medium">
                        {deriveSessionTitle(session) || 'Session sans titre'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {years.yearFrom ? `${years.yearFrom} → ${years.yearTo ?? '…'}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={session.state === 'OPEN' ? 'secondary' : 'outline'}>
                          {session.state === 'OPEN' ? 'Ouverte' : 'Verrouillée'}
                        </Badge>
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
                            <Link href={`/sessions/${session.id}/workspace`}>Espace de travail</Link>
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
