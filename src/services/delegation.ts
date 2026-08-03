import type { Db } from './db';
import { forbiddenError, notFoundError } from './errors';
import { logAudit } from './audit';
import type { Actor } from './rbac';

export const ACTION_SESSION_AGENT_ADDED = 'SESSION_AGENT_ADDED';
export const ACTION_SESSION_AGENT_REMOVED = 'SESSION_AGENT_REMOVED';

export interface SessionAgentInfo {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  assignedAt: Date;
}

export async function delegateSession(
  db: Db,
  trainingSessionId: string,
  userId: string,
  actorId: string,
): Promise<void> {
  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { id: true },
  });
  if (!session) {
    throw notFoundError('Session de formation introuvable.', { trainingSessionId });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== 'USER') {
    throw notFoundError('Utilisateur introuvable ou non éligible.', { userId });
  }

  await db.sessionAgent.create({
    data: {
      trainingSessionId,
      userId,
      assignedBy: actorId,
    },
  });

  await logAudit(db, {
    actorId,
    action: ACTION_SESSION_AGENT_ADDED,
    entityType: 'TrainingSession',
    entityId: trainingSessionId,
    newValue: { userId },
  });
}

export async function undelegateSession(
  db: Db,
  trainingSessionId: string,
  userId: string,
  actorId: string,
): Promise<void> {
  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { id: true },
  });
  if (!session) {
    throw notFoundError('Session de formation introuvable.', { trainingSessionId });
  }

  const existing = await db.sessionAgent.findFirst({
    where: { trainingSessionId, userId },
  });
  if (!existing) {
    throw notFoundError('Délégation introuvable.', { trainingSessionId, userId });
  }

  await db.sessionAgent.delete({
    where: { id: existing.id },
  });

  await logAudit(db, {
    actorId,
    action: ACTION_SESSION_AGENT_REMOVED,
    entityType: 'TrainingSession',
    entityId: trainingSessionId,
    oldValue: { userId },
  });
}

export async function getSessionAgents(
  db: Db,
  trainingSessionId: string,
): Promise<SessionAgentInfo[]> {
  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { id: true },
  });
  if (!session) {
    throw notFoundError('Session de formation introuvable.', { trainingSessionId });
  }

  const agents = await db.sessionAgent.findMany({
    where: { trainingSessionId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { assignedAt: 'asc' },
  });

  return agents.map((agent) => ({
    id: agent.id,
    userId: agent.userId,
    userName: agent.user.name,
    userEmail: agent.user.email,
    assignedAt: agent.assignedAt,
  }));
}

export async function getUserDelegatedSessions(
  db: Db,
  userId: string,
): Promise<string[]> {
  const assignments = await db.sessionAgent.findMany({
    where: { userId },
    select: { trainingSessionId: true },
  });
  return assignments.map((a) => a.trainingSessionId);
}

export async function canAccessSession(
  db: Db,
  actor: Actor | null | undefined,
  trainingSessionId: string,
): Promise<boolean> {
  if (!actor) return false;

  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { id: true },
  });
  if (!session) return false;

  if (actor.role === 'MANAGER' || actor.role === 'ADMIN') return true;

  const delegation = await db.sessionAgent.findFirst({
    where: { trainingSessionId, userId: actor.id },
    select: { id: true },
  });

  return !!delegation;
}

export async function assertSessionAccess(
  db: Db,
  trainingSessionId: string,
  actor: Actor | null | undefined,
): Promise<void> {
  if (!actor) {
    throw forbiddenError('Authentification requise.');
  }

  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { id: true },
  });
  if (!session) {
    throw notFoundError('Session de formation introuvable.', { trainingSessionId });
  }

  if (actor.role === 'MANAGER' || actor.role === 'ADMIN') return;

  const delegation = await db.sessionAgent.findFirst({
    where: { trainingSessionId, userId: actor.id },
    select: { id: true },
  });

  if (!delegation) {
    throw forbiddenError("Vous n'êtes pas délégué sur cette session.", {
      trainingSessionId,
    });
  }
}
