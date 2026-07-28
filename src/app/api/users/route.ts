import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { readJson, route } from '@/lib/api/handler';
import { orderByFor, paginate, parseListQuery, searchFilter, skipTake } from '@/lib/api/pagination';
import { userSchema } from '@/lib/validation/schemas';
import { validationError } from '@/services/errors';

/** Champs exposés : le hachage du mot de passe ne sort jamais de l'API. */
const PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const GET = route({ resource: 'User', access: 'read' }, async ({ db, url }) => {
  const query = parseListQuery(url);
  const where = searchFilter(query, ['email', 'name']) ?? {};

  const [data, total] = await Promise.all([
    db.user.findMany({
      where,
      select: PUBLIC_FIELDS,
      ...skipTake(query),
      orderBy: orderByFor(query, ['email', 'name', 'role', 'createdAt'], { name: 'asc' }),
    }),
    db.user.count({ where }),
  ]);

  return paginate(data, total, query);
});

export const POST = route({ resource: 'User', access: 'write' }, async ({ db, request }) => {
  const input = await readJson(request, userSchema);
  if (!input.password) {
    throw validationError('Mot de passe requis à la création.', [
      { path: 'password', message: 'Mot de passe requis' },
    ]);
  }

  const created = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      active: input.active ?? true,
      passwordHash: await bcrypt.hash(input.password, 10),
    },
    select: PUBLIC_FIELDS,
  });

  return NextResponse.json(created, { status: 201 });
});
