import bcrypt from 'bcryptjs';
import { readJson, route } from '@/lib/api/handler';
import { userSchema } from '@/lib/validation/schemas';
import { conflictError, notFoundError } from '@/services/errors';

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const GET = route<{ id: string }>(
  { resource: 'User', access: 'read' },
  async ({ db, params }) => {
    const user = await db.user.findUnique({ where: { id: params.id }, select: PUBLIC_FIELDS });
    if (!user) throw notFoundError('Compte introuvable.', { id: params.id });
    return user;
  },
);

export const PATCH = route<{ id: string }>(
  { resource: 'User', access: 'write' },
  async ({ db, params, request, actor }) => {
    const input = await readJson(request, userSchema.partial());

    // Se retirer soi-même le rôle ADMIN ou se désactiver enfermerait dehors le
    // dernier administrateur : on refuse plutôt que de laisser faire.
    if (params.id === actor.id) {
      if (input.role && input.role !== 'ADMIN') {
        throw conflictError('Vous ne pouvez pas retirer votre propre rôle administrateur.');
      }
      if (input.active === false) {
        throw conflictError('Vous ne pouvez pas désactiver votre propre compte.');
      }
    }

    const { password, ...rest } = input;

    return db.user.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
      select: PUBLIC_FIELDS,
    });
  },
);

export const DELETE = route<{ id: string }>(
  { resource: 'User', access: 'write' },
  async ({ db, params, actor }) => {
    if (params.id === actor.id) {
      throw conflictError('Vous ne pouvez pas supprimer votre propre compte.');
    }
    await db.user.delete({ where: { id: params.id } });
    return undefined; // 204
  },
);
