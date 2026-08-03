import { beforeEach, describe, expect, it } from 'vitest';
import {
  canReadSession,
  canWriteSession,
  assertCanWriteSession,
} from '@/services/rbac';
import {
  delegateSession,
  undelegateSession,
  getSessionAgents,
  getUserDelegatedSessions,
  assertSessionAccess,
} from '@/services/delegation';
import { ServiceError } from '@/services/errors';
import { databaseAvailable, prisma, resetDatabase, createTraining, createSession } from './helpers';

const hasDb = await databaseAvailable();

describe.skipIf(!hasDb)('délégation de sessions', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('délègue et retire un agent sur une session', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const manager = await prisma.user.create({
      data: { email: `manager-${Date.now()}@test.local`, passwordHash: 'hash', name: 'Manager', role: 'MANAGER' },
    });
    const user = await prisma.user.create({
      data: { email: `user-${Date.now()}@test.local`, passwordHash: 'hash', name: 'User', role: 'USER' },
    });

    await delegateSession(prisma, session.id, user.id, manager.id);
    const agents = await getSessionAgents(prisma, session.id);
    expect(agents).toHaveLength(1);
    expect(agents[0]!.userId).toBe(user.id);

    await undelegateSession(prisma, session.id, user.id, manager.id);
    const agentsAfter = await getSessionAgents(prisma, session.id);
    expect(agentsAfter).toHaveLength(0);
  });

  it('refuse de déléguer un USER inexistant', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const manager = await prisma.user.create({
      data: { email: `manager2-${Date.now()}@test.local`, passwordHash: 'hash', name: 'Manager', role: 'MANAGER' },
    });

    await expect(delegateSession(prisma, session.id, 'missing-user', manager.id)).rejects.toThrow();
  });

  it('list les sessions déléguées pour un USER', async () => {
    const { training } = await createTraining();
    const sessionA = await createSession(training.id);
    const _sessionB = await createSession(training.id);
    const manager = await prisma.user.create({
      data: { email: `manager3-${Date.now()}@test.local`, passwordHash: 'hash', name: 'Manager', role: 'MANAGER' },
    });
    const user = await prisma.user.create({
      data: { email: `user3-${Date.now()}@test.local`, passwordHash: 'hash', name: 'User', role: 'USER' },
    });

    await delegateSession(prisma, sessionA.id, user.id, manager.id);
    const sessions = await getUserDelegatedSessions(prisma, user.id);
    expect(sessions).toEqual([sessionA.id]);
  });

  it('canReadSession retourne true pour MANAGER/ADMIN', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const manager = { id: 'm', role: 'MANAGER' as const };
    const admin = { id: 'a', role: 'ADMIN' as const };

    expect(await canReadSession(manager, prisma, session.id)).toBe(true);
    expect(await canReadSession(admin, prisma, session.id)).toBe(true);
  });

  it('canReadSession retourne true pour USER délégué, false sinon', async () => {
    const { training } = await createTraining();
    const sessionA = await createSession(training.id);
    const sessionB = await createSession(training.id);
    const manager = await prisma.user.create({
      data: { email: `manager4-${Date.now()}@test.local`, passwordHash: 'hash', name: 'Manager', role: 'MANAGER' },
    });
    const user = await prisma.user.create({
      data: { email: `user4-${Date.now()}@test.local`, passwordHash: 'hash', name: 'User', role: 'USER' },
    });

    await delegateSession(prisma, sessionA.id, user.id, manager.id);

    expect(await canReadSession({ id: user.id, role: 'USER' }, prisma, sessionA.id)).toBe(true);
    expect(await canReadSession({ id: user.id, role: 'USER' }, prisma, sessionB.id)).toBe(false);
  });

  it('assertSessionAccess lève 404 sur session inexistante', async () => {
    const manager = { id: 'm', role: 'MANAGER' as const };
    await expect(assertSessionAccess(prisma, 'missing-session', manager)).rejects.toThrow(ServiceError);
  });

  it('assertSessionAccess lève 403 pour USER non délégué', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const user = { id: 'u', role: 'USER' as const };

    await expect(assertSessionAccess(prisma, session.id, user)).rejects.toThrow(ServiceError);
    try {
      await assertSessionAccess(prisma, session.id, user);
    } catch (error) {
      expect((error as ServiceError).status).toBe(403);
      expect((error as ServiceError).code).toBe('FORBIDDEN');
    }
  });

  it('canWriteSession suit la même logique que canReadSession', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const manager = await prisma.user.create({
      data: { email: `manager5-${Date.now()}@test.local`, passwordHash: 'hash', name: 'Manager', role: 'MANAGER' },
    });
    const user = await prisma.user.create({
      data: { email: `user5-${Date.now()}@test.local`, passwordHash: 'hash', name: 'User', role: 'USER' },
    });

    await delegateSession(prisma, session.id, user.id, manager.id);

    expect(await canWriteSession({ id: user.id, role: 'USER' }, prisma, session.id)).toBe(true);
    expect(await canWriteSession({ id: user.id, role: 'USER' }, prisma, 'other-session')).toBe(false);
  });

  it('assertCanWriteSession lève 403 pour USER non délégué', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const user = await prisma.user.create({
      data: { email: `user6-${Date.now()}@test.local`, passwordHash: 'hash', name: 'User', role: 'USER' },
    });

    await expect(assertCanWriteSession({ id: user.id, role: 'USER' }, prisma, session.id)).rejects.toThrow(ServiceError);
    try {
      await assertCanWriteSession({ id: user.id, role: 'USER' }, prisma, session.id);
    } catch (error) {
      expect((error as ServiceError).status).toBe(403);
      expect((error as ServiceError).code).toBe('FORBIDDEN');
    }
  });
});
