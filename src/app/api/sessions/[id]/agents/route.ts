import { route } from '@/lib/api/handler';
import { getSessionAgents, delegateSession, undelegateSession } from '@/services/delegation';
import { canManageSessions } from '@/services/rbac';
import { forbiddenError } from '@/services/errors';
import { NextResponse } from 'next/server';

export const GET = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'read' },
  async ({ db, params }) => {
    return getSessionAgents(db, params.id);
  },
);

export const POST = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'write' },
  async ({ db, params, request, actor }) => {
    if (!canManageSessions(actor.role)) {
      throw forbiddenError('Seuls MANAGER et ADMIN peuvent déléguer des sessions.', {
        role: actor.role,
      });
    }

    const payload = await request.json().catch(() => ({}));
    const userId = typeof payload?.userId === 'string' && payload.userId.length > 0
      ? payload.userId
      : (() => { throw new Error('userId requis'); })();

    await delegateSession(db, params.id, userId, actor.id);
    return new NextResponse(null, { status: 201 });
  },
);

export const DELETE = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'write' },
  async ({ db, params, request, actor }) => {
    if (!canManageSessions(actor.role)) {
      throw forbiddenError('Seuls MANAGER et ADMIN peuvent retirer une délégation.', {
        role: actor.role,
      });
    }

    const payload = await request.json().catch(() => ({}));
    const userId = typeof payload?.userId === 'string' && payload.userId.length > 0
      ? payload.userId
      : (() => { throw new Error('userId requis'); })();

    await undelegateSession(db, params.id, userId, actor.id);
    return new NextResponse(null, { status: 204 });
  },
);
