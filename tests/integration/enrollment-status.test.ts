import { beforeEach, describe, expect, it } from 'vitest';
import {
  transitionEnrollmentStatus,
} from '@/services/enrollmentStatus';
import { delegateSession } from '@/services/delegation';
import { lockSession } from '@/services/locking';
import { enroll } from '@/services/enrollment';
import {
  createParticipants,
  createSession,
  createTraining,
  databaseAvailable,
  prisma,
  resetDatabase,
} from './helpers';

const hasDb = await databaseAvailable();

type Actor = { id: string; role: 'MANAGER' | 'USER' | 'ADMIN' };

async function setupScenario() {
  const { training } = await createTraining();
  const session = await createSession(training.id);
  const [participant] = await createParticipants(1);
  await enroll(prisma, session.id, [participant!.id!]);
  const enrollment = await prisma.enrollment.findFirstOrThrow({
    where: { trainingSessionId: session.id },
  });

  const manager = await prisma.user.create({
    data: {
      email: `mgr-${Date.now()}@test.local`,
      passwordHash: 'hash',
      name: 'Manager',
      role: 'MANAGER',
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `usr-${Date.now()}@test.local`,
      passwordHash: 'hash',
      name: 'User',
      role: 'USER',
    },
  });

  return { session, enrollment, manager, user, training, participant };
}

describe.skipIf(!hasDb)('transitionEnrollmentStatus — machine à états', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('PENDING → CONFIRMED est acceptée et auditée', async () => {
    const { enrollment, manager } = await setupScenario();

    const result = await transitionEnrollmentStatus(
      prisma,
      enrollment.id,
      'CONFIRMED',
      manager.id,
      'MANAGER',
      'Vérification manuelle',
    );

    expect(result).toMatchObject({
      status: 'CONFIRMED',
      previousStatus: 'PENDING',
      statusChangedBy: manager.id,
    });

    const updated = await prisma.enrollment.findUnique({
      where: { id: enrollment.id },
      select: { status: true, statusChangedAt: true, statusChangedBy: true },
    });
    expect(updated?.status).toBe('CONFIRMED');
    expect(updated?.statusChangedBy).toBe(manager.id);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: enrollment.id, action: 'ENROLLMENT_STATUS_CHANGED' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.oldValue).toMatchObject({ status: 'PENDING' });
    expect(audit?.newValue).toMatchObject({ status: 'CONFIRMED' });
  });

  it('PENDING → ACTIVE est refusée (409)', async () => {
    const { enrollment, manager } = await setupScenario();

    await expect(
      transitionEnrollmentStatus(prisma, enrollment.id, 'ACTIVE', manager.id, 'MANAGER'),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });

    const unchanged = await prisma.enrollment.findUnique({
      where: { id: enrollment.id },
      select: { status: true },
    });
    expect(unchanged?.status).toBe('PENDING');
  });

  it('PENDING → CONFIRMED → ACTIVE → COMPLETED est une chaîne valide', async () => {
    const { enrollment, manager } = await setupScenario();

    await transitionEnrollmentStatus(prisma, enrollment.id, 'CONFIRMED', manager.id, 'MANAGER');
    await transitionEnrollmentStatus(prisma, enrollment.id, 'ACTIVE', manager.id, 'MANAGER');
    const result = await transitionEnrollmentStatus(prisma, enrollment.id, 'COMPLETED', manager.id, 'MANAGER');

    expect(result.status).toBe('COMPLETED');
    expect(result.previousStatus).toBe('ACTIVE');
  });

  it('COMPLETED → CANCELLED est refusée (409)', async () => {
    const { enrollment, manager } = await setupScenario();

    await transitionEnrollmentStatus(prisma, enrollment.id, 'CONFIRMED', manager.id, 'MANAGER');
    await transitionEnrollmentStatus(prisma, enrollment.id, 'ACTIVE', manager.id, 'MANAGER');
    await transitionEnrollmentStatus(prisma, enrollment.id, 'COMPLETED', manager.id, 'MANAGER');

    await expect(
      transitionEnrollmentStatus(prisma, enrollment.id, 'CANCELLED', manager.id, 'MANAGER'),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
  });

  it('refuse un statut identique (409)', async () => {
    const { enrollment, manager } = await setupScenario();

    await expect(
      transitionEnrollmentStatus(prisma, enrollment.id, 'PENDING', manager.id, 'MANAGER'),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
  });
});

describe.skipIf(!hasDb)('transitionEnrollmentStatus — RBAC délégation', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('MANAGER peut transitionner sans délégation', async () => {
    const { enrollment, manager } = await setupScenario();
    const actor: Actor = { id: manager.id, role: 'MANAGER' };

    const result = await transitionEnrollmentStatus(
      prisma,
      enrollment.id,
      'CONFIRMED',
      actor.id,
      actor.role,
    );
    expect(result.status).toBe('CONFIRMED');
  });

  it('USER non délégué est refusé (403)', async () => {
    const { enrollment, user } = await setupScenario();
    const actor: Actor = { id: user.id, role: 'USER' };

    await expect(
      transitionEnrollmentStatus(prisma, enrollment.id, 'CONFIRMED', actor.id, actor.role),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });

    const unchanged = await prisma.enrollment.findUnique({
      where: { id: enrollment.id },
      select: { status: true },
    });
    expect(unchanged?.status).toBe('PENDING');
  });

  it('USER délégué peut transitionner (200)', async () => {
    const { enrollment, manager, user, session } = await setupScenario();
    await delegateSession(prisma, session.id, user.id, manager.id);

    const actor: Actor = { id: user.id, role: 'USER' };
    const result = await transitionEnrollmentStatus(
      prisma,
      enrollment.id,
      'CONFIRMED',
      actor.id,
      actor.role,
    );
    expect(result.status).toBe('CONFIRMED');

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: enrollment.id, action: 'ENROLLMENT_STATUS_CHANGED' },
    });
    expect(audit?.actorId).toBe(user.id);
  });

  it('USER délégué sur session verrouillée est refusé (409 LOCKED, pas 403)', async () => {
    const { enrollment, manager, user, session } = await setupScenario();
    await delegateSession(prisma, session.id, user.id, manager.id);
    await lockSession(prisma, session.id);

    const actor: Actor = { id: user.id, role: 'USER' };
    await expect(
      transitionEnrollmentStatus(prisma, enrollment.id, 'CONFIRMED', actor.id, actor.role),
    ).rejects.toMatchObject({ code: 'LOCKED', status: 409 });
  });
});

describe.skipIf(!hasDb)('transitionEnrollmentStatus — 404', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('refuse une inscription inexistante (404)', async () => {
    const manager = await prisma.user.create({
      data: {
        email: `mgr2-${Date.now()}@test.local`,
        passwordHash: 'hash',
        name: 'Manager',
        role: 'MANAGER',
      },
    });

    await expect(
      transitionEnrollmentStatus(prisma, 'missing-enrollment', 'CONFIRMED', manager.id, 'MANAGER'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
