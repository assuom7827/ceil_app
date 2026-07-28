import { route } from '@/lib/api/handler';
import { deriveParticipantFullName, deriveSessionTitle } from '@/services/derive';
import { notFoundError } from '@/services/errors';

/**
 * Grille des inscrits de la session.
 *
 * Les valeurs dérivées (`fullName`, `title`) sont calculées ici par les mêmes
 * fonctions que celles importées par l'UI : la grille n'a jamais à les
 * recalculer autrement.
 */
export const GET = route<{ id: string }>(
  { resource: 'Enrollment', access: 'read' },
  async ({ db, params }) => {
    const session = await db.trainingSession.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        state: true,
        academicYear: true,
        admissionThreshold: true,
        matriculePrefix: true,
        training: { select: { frName: true, arName: true } },
        trainingLevel: { select: { name: true } },
      },
    });
    if (!session) throw notFoundError('Session de formation introuvable.', { id: params.id });

    const enrollments = await db.enrollment.findMany({
      where: { trainingSessionId: params.id },
      orderBy: [{ participant: { familyName: 'asc' } }, { participant: { firstName: 'asc' } }],
      select: {
        id: true,
        kind: true,
        registrationNumber: true,
        enrolledAt: true,
        responsible: true,
        participant: {
          select: {
            id: true,
            familyName: true,
            firstName: true,
            arabName: true,
            arabFirstName: true,
            registrationNumber: true,
            phone: true,
            type: true,
          },
        },
        assignedLevel: { select: { id: true, name: true } },
        sessionGroup: { select: { id: true, name: true } },
        examGroup: { select: { id: true, name: true } },
      },
    });

    return {
      session: {
        id: session.id,
        state: session.state,
        title: deriveSessionTitle(session),
        admissionThreshold: session.admissionThreshold,
        matriculePrefix: session.matriculePrefix,
      },
      rows: enrollments.map((enrollment) => ({
        ...enrollment,
        fullName: deriveParticipantFullName(enrollment.participant),
      })),
    };
  },
);
