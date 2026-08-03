import { route } from '@/lib/api/handler';
import { paginate, parseListQuery } from '@/lib/api/pagination';
import { deriveParticipantFullName, deriveSessionTitle } from '@/services/derive';
import { notFoundError } from '@/services/errors';
import { assertSessionAccess } from '@/services/locking';

export const GET = route<{ id: string }>(
  { resource: 'Enrollment', access: 'read' },
  async ({ db, params, url, actor }) => {
    await assertSessionAccess(db, params.id, actor);
    const query = parseListQuery(url);
    const session = await db.trainingSession.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        state: true,
        academicYear: true,
        admissionThreshold: true,
        matriculePrefix: true,
        training: {
          select: {
            frName: true,
            arName: true,
            TrainingToTrainingLevel: {
              select: { training_levels: { select: { id: true, name: true } } },
            },
          },
        },
        trainingLevel: { select: { name: true } },
      },
    });
    if (!session) throw notFoundError('Session de formation introuvable.', { id: params.id });

    const where = {
      trainingSessionId: params.id,
      ...(query.q
        ? {
            OR: [
              { participant: { familyName: { contains: query.q, mode: 'insensitive' as const } } },
              { participant: { firstName: { contains: query.q, mode: 'insensitive' as const } } },
              { participant: { phone: { contains: query.q, mode: 'insensitive' as const } } },
              { registrationNumber: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [enrollments, total] = await Promise.all([
      db.enrollment.findMany({
        where,
        orderBy: [
          { participant: { familyName: query.order === 'asc' ? 'asc' : 'desc' } },
          { participant: { firstName: query.order === 'asc' ? 'asc' : 'desc' } },
        ],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        select: {
          id: true,
          kind: true,
          status: true,
          statusChangedAt: true,
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
      }),
      db.enrollment.count({ where }),
    ]);

    return {
      session: {
        id: session.id,
        state: session.state,
        title: deriveSessionTitle(session),
        admissionThreshold: session.admissionThreshold,
        matriculePrefix: session.matriculePrefix,
        levels: session.training.TrainingToTrainingLevel.map((lt) => lt.training_levels),
      },
      rows: enrollments.map((enrollment) => ({
        ...enrollment,
        fullName: deriveParticipantFullName(enrollment.participant),
      })),
      meta: paginate(enrollments, total, query).meta,
    };
  },
);
