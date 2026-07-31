import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Role } from '@/services/rbac';

const mocked = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string } } | null,
}));

vi.mock('@/auth', () => ({
  auth: async () => mocked.session,
}));

import {
  POST as lockSessionRoute,
} from '@/app/api/sessions/[id]/lock/route';
import {
  POST as unlockSessionRoute,
} from '@/app/api/sessions/[id]/unlock/route';
import {
  PUT as saveDeliberationRoute,
} from '@/app/api/sessions/[id]/deliberation/route';
import {
  PUT as savePositioningScoresRoute,
} from '@/app/api/positioning-tests/[id]/scores/route';
import { POST as resolveLevelsActionRoute } from '@/app/api/positioning-tests/[id]/resolve-levels/route';
import {
  POST as lockPositioningTestRoute,
} from '@/app/api/positioning-tests/[id]/lock/route';
import {
  POST as unlockPositioningTestRoute,
} from '@/app/api/positioning-tests/[id]/unlock/route';
import { PATCH as _patchEnrollmentRoute, DELETE as deleteEnrollmentRoute } from '@/app/api/enrollments/[id]/route';
import { POST as enrollRoute } from '@/app/api/sessions/[id]/enroll/route';
import { GET as listAuditLogsRoute } from '@/app/api/audit-logs/route';
import {
  createParticipants,
  createSession,
  createTraining as makeTraining,
  databaseAvailable,
  prisma,
  resetDatabase,
} from './helpers';
import { enroll } from '@/services/enrollment';

const hasDb = await databaseAvailable();

function signIn(role: Role | null) {
  mocked.session = role ? { user: { id: 'user-test', role } } : null;
}

function request(url: string, init?: { method?: string; body?: unknown }) {
  return new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? 'GET',
    ...(init?.body === undefined
      ? {}
      : { body: JSON.stringify(init.body), headers: { 'content-type': 'application/json' } }),
  });
}

function params<T extends object>(value: T) {
  return { params: Promise.resolve(value) };
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe.skipIf(!hasDb)('audit trail', () => {
  beforeEach(async () => {
    await resetDatabase();
    signIn('MANAGER');
  });

  it('loge le verrouillage et le déverrouillage d’une session', async () => {
    const { training } = await makeTraining();
    const session = await createSession(training.id);

    await lockSessionRoute(request('', { method: 'POST' }), params({ id: session.id }));
    await unlockSessionRoute(request('', { method: 'POST' }), params({ id: session.id }));

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'TrainingSession', entityId: session.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      actorId: 'user-test',
      action: 'SESSION_LOCKED',
      oldValue: { state: 'OPEN' },
      newValue: { state: 'LOCKED' },
    });
    expect(logs[1]).toMatchObject({
      actorId: 'user-test',
      action: 'SESSION_UNLOCKED',
      oldValue: { state: 'LOCKED' },
      newValue: { state: 'OPEN' },
    });
  });

  it('loge les notes de délibération', async () => {
    const { training } = await makeTraining();
    const session = await createSession(training.id);
    const participants = await createParticipants(1);
    await enroll(prisma, session.id, participants.map((p) => p.id));
    const enrollments = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id },
    });

    await saveDeliberationRoute(
      request('', {
        method: 'PUT',
        body: {
          entries: [
            {
              enrollmentId: enrollments[0]!.id,
              oralExpression: 10,
              writtenExpression: 10,
              oralComprehension: 10,
              writtenComprehension: 10,
            },
          ],
        },
      }),
      params({ id: session.id }),
    );

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'DeliberationEntry' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: 'user-test',
      action: 'DELIBERATION_SCORE_UPSERTED',
      entityId: expect.stringMatching(/^.+$/),
      oldValue: null,
      newValue: {
        oralExpression: 10,
        writtenExpression: 10,
        oralComprehension: 10,
        writtenComprehension: 10,
      },
    });
  });

  it('loge les notes de positionnement', async () => {
    const { training } = await makeTraining();
    const session = await createSession(training.id);
    const participants = await createParticipants(1);
    await enroll(prisma, session.id, participants.map((p) => p.id));
    const enrollments = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id },
    });
    const test = await prisma.positioningTest.create({ data: { trainingId: training.id } });

    await savePositioningScoresRoute(
      request('', {
        method: 'PUT',
        body: {
          scores: [
            {
              enrollmentId: enrollments[0]!.id,
              writtenExpression: 20,
              writtenComprehension: 20,
            },
          ],
        },
      }),
      params({ id: test.id }),
    );

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'PositioningScore' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: 'user-test',
      action: 'POSITIONING_SCORE_UPSERTED',
      oldValue: null,
      newValue: {
        writtenExpression: 20,
        writtenComprehension: 20,
      },
    });
  });

  it('loge la résolution des niveaux', async () => {
    const { training } = await makeTraining();
    const session = await createSession(training.id);
    const participants = await createParticipants(1);
    await enroll(prisma, session.id, participants.map((p) => p.id));
    const enrollments = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id },
    });
    const test = await prisma.positioningTest.create({ data: { trainingId: training.id } });
    await prisma.positioningScore.create({
      data: {
        enrollmentId: enrollments[0]!.id,
        positioningTestId: test.id,
        writtenExpression: 60,
        writtenComprehension: 0,
      },
    });

    await resolveLevelsActionRoute(request('', { method: 'POST' }), params({ id: test.id }));

    const logs = await prisma.auditLog.findMany({
      where: { action: 'ENROLLMENT_LEVEL_RESOLVED' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: 'user-test',
      entityType: 'Enrollment',
      entityId: enrollments[0]!.id,
      oldValue: { assignedLevelId: null },
      newValue: { assignedLevelId: expect.stringMatching(/^.+$/) },
    });
  });

  it('loge la suppression d’une inscription', async () => {
    const { training } = await makeTraining();
    const session = await createSession(training.id);
    const participants = await createParticipants(1);
    await enroll(prisma, session.id, participants.map((p) => p.id));
    const enrollments = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id },
    });

    await deleteEnrollmentRoute(request('', { method: 'DELETE' }), params({ id: enrollments[0]!.id }));

    const logs = await prisma.auditLog.findMany({
      where: { action: 'ENROLLMENT_REMOVED' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: 'user-test',
      entityType: 'Enrollment',
      entityId: enrollments[0]!.id,
      oldValue: {
        participantId: participants[0]!.id,
        trainingSessionId: session.id,
        registrationNumber: expect.stringMatching(/^.+$/),
      },
    });
  });

  it('loge l’inscription d’un participant', async () => {
    const { training } = await makeTraining();
    const session = await createSession(training.id);
    const participants = await createParticipants(1);

    await enrollRoute(
      request(`/api/sessions/${session.id}/enroll`, {
        method: 'POST',
        body: { participantIds: [participants[0]!.id] },
      }),
      params({ id: session.id }),
    );

    const enrollment = await prisma.enrollment.findFirst({
      where: { trainingSessionId: session.id },
    });

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Enrollment', action: 'ENROLLMENT_CREATED' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: 'user-test',
      entityId: enrollment!.id,
      newValue: {
        participantId: participants[0]!.id,
        trainingSessionId: session.id,
        kind: 'NEW',
        registrationNumber: expect.stringMatching(/^.+$/),
      },
    });
  });

  it('autorise la consultation des logs à MANAGER et ADMIN, pas à USER', async () => {
    const { training } = await makeTraining();
    const session = await createSession(training.id);
    await lockSessionRoute(request('', { method: 'POST' }), params({ id: session.id }));

    signIn('MANAGER');
    const managerResponse = await listAuditLogsRoute(request('/api/audit-logs'), params({}));
    expect(managerResponse.status).toBe(200);

    signIn('ADMIN');
    const adminResponse = await listAuditLogsRoute(request('/api/audit-logs'), params({}));
    expect(adminResponse.status).toBe(200);

    signIn('USER');
    const userResponse = await listAuditLogsRoute(request('/api/audit-logs'), params({}));
    expect(userResponse.status).toBe(403);
  });

  it('filtre les logs par entityType et entityId', async () => {
    const { training } = await makeTraining();
    const session = await createSession(training.id);
    await lockSessionRoute(request('', { method: 'POST' }), params({ id: session.id }));

    const response = await listAuditLogsRoute(
      request(`/api/audit-logs?entityType=TrainingSession&entityId=${session.id}`),
      params({}),
    );
    const body = await bodyOf(response);

    expect(body['meta']).toMatchObject({ total: 1 });
    expect((body['data'] as unknown[])[0]).toMatchObject({
      entityType: 'TrainingSession',
      entityId: session.id,
    });
  });

  it('loge le verrouillage d’un test de positionnement', async () => {
    const { training } = await makeTraining();
    const test = await prisma.positioningTest.create({ data: { trainingId: training.id } });

    await lockPositioningTestRoute(request('', { method: 'POST' }), params({ id: test.id }));
    await unlockPositioningTestRoute(request('', { method: 'POST' }), params({ id: test.id }));

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'PositioningTest', entityId: test.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      action: 'POSITIONING_TEST_LOCKED',
      oldValue: { state: 'OPEN' },
      newValue: { state: 'LOCKED' },
    });
  });
});
