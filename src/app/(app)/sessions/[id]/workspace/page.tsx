import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { deriveSessionTitle, deriveYears } from '@/services/derive';
import { canWrite } from '@/services/rbac';
import { Workspace } from './workspace';

export const metadata: Metadata = { title: 'Espace de travail' };

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;

  const session = await prisma.trainingSession.findUnique({
    where: { id },
    select: {
      id: true,
      state: true,
      academicYear: true,
      dateFrom: true,
      dateTo: true,
      admissionThreshold: true,
      matriculePrefix: true,
      training: { select: { id: true, frName: true, arName: true } },
      trainingLevel: { select: { name: true } },
    },
  });

  if (!session) notFound();

  return (
    <Workspace
      session={{
        id: session.id,
        title: deriveSessionTitle(session) || 'Session sans titre',
        trainingName: session.training.frName,
        levelName: session.trainingLevel?.name ?? null,
        academicYear: session.academicYear,
        years: deriveYears(session),
        state: session.state,
        admissionThreshold: session.admissionThreshold,
        matriculePrefix: session.matriculePrefix,
      }}
      // Le droit est calculé côté serveur ; l'UI ne fait que refléter la
      // décision, et l'API la revérifie à chaque appel.
      permissions={{
        enrollment: canWrite(actor, 'Enrollment'),
        scores: canWrite(actor, 'DeliberationEntry'),
        groups: canWrite(actor, 'StudentGroup'),
        session: canWrite(actor, 'TrainingSession'),
      }}
    />
  );
}
