import { NextResponse } from 'next/server';
import { route } from '@/lib/api/handler';
import { canManageSessions } from '@/services/rbac';

export const GET = route<{ id: string }>({ resource: 'TrainingSession', access: 'write' }, async ({ db, actor }) => {
  if (!canManageSessions(actor.role)) {
    return NextResponse.json([], { status: 403 });
  }

  const users = await db.user.findMany({
    where: { role: 'USER', active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(users);
});
