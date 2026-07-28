/**
 * Administration des comptes : la ressource `User` est réservée à ADMIN,
 * y compris en lecture — un MANAGER ne doit pas énumérer les comptes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Role } from '@/services/rbac';

const mocked = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string } } | null,
}));

vi.mock('@/auth', () => ({ auth: async () => mocked.session }));

import { GET as listUsers, POST as createUser } from '@/app/api/users/route';
import { DELETE as deleteUser, PATCH as patchUser } from '@/app/api/users/[id]/route';
import { databaseAvailable, prisma } from './helpers';

const hasDb = await databaseAvailable();

function signIn(role: Role | null, id = 'acting-user') {
  mocked.session = role ? { user: { id, role } } : null;
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

describe.skipIf(!hasDb)('API — comptes', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
    signIn('ADMIN');
  });

  it('refuse la lecture à MANAGER (403)', async () => {
    signIn('MANAGER');
    expect((await listUsers(request('/api/users'), params({}))).status).toBe(403);
  });

  it('refuse la lecture à USER (403)', async () => {
    signIn('USER');
    expect((await listUsers(request('/api/users'), params({}))).status).toBe(403);
  });

  it('autorise ADMIN', async () => {
    expect((await listUsers(request('/api/users'), params({}))).status).toBe(200);
  });

  it('crée un compte sans jamais exposer le hachage', async () => {
    const response = await createUser(
      request('/api/users', {
        method: 'POST',
        body: {
          email: 'nouveau@ceil.local',
          name: 'Nouveau',
          role: 'USER',
          password: 'MotDePasseSolide1!',
        },
      }),
      params({}),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ email: 'nouveau@ceil.local', role: 'USER' });
    expect(body).not.toHaveProperty('passwordHash');

    // Le mot de passe est bien haché en base.
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'nouveau@ceil.local' } });
    expect(stored.passwordHash).not.toBe('MotDePasseSolide1!');
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
  });

  it('refuse un mot de passe trop court', async () => {
    const response = await createUser(
      request('/api/users', {
        method: 'POST',
        body: { email: 'court@ceil.local', name: 'Court', role: 'USER', password: 'abc' },
      }),
      params({}),
    );
    expect(response.status).toBe(400);
  });

  it('exige un mot de passe à la création', async () => {
    const response = await createUser(
      request('/api/users', {
        method: 'POST',
        body: { email: 'sans@ceil.local', name: 'Sans', role: 'USER' },
      }),
      params({}),
    );
    expect(response.status).toBe(400);
  });

  it('n’expose jamais le hachage en liste', async () => {
    await createUser(
      request('/api/users', {
        method: 'POST',
        body: { email: 'a@ceil.local', name: 'A', role: 'USER', password: 'MotDePasseSolide1!' },
      }),
      params({}),
    );

    const body = (await (await listUsers(request('/api/users'), params({}))).json()) as {
      data: Array<Record<string, unknown>>;
    };
    expect(body.data[0]).not.toHaveProperty('passwordHash');
  });

  /** Garde-fou : le dernier administrateur ne doit pas pouvoir s'enfermer dehors. */
  it('empêche un administrateur de se retirer son propre rôle', async () => {
    const admin = await prisma.user.create({
      data: { email: 'admin@ceil.local', name: 'Admin', role: 'ADMIN', passwordHash: 'x' },
    });
    signIn('ADMIN', admin.id);

    const response = await patchUser(
      request(`/api/users/${admin.id}`, { method: 'PATCH', body: { role: 'USER' } }),
      params({ id: admin.id }),
    );
    expect(response.status).toBe(409);
  });

  it('empêche un administrateur de se désactiver', async () => {
    const admin = await prisma.user.create({
      data: { email: 'admin2@ceil.local', name: 'Admin', role: 'ADMIN', passwordHash: 'x' },
    });
    signIn('ADMIN', admin.id);

    const response = await patchUser(
      request('', { method: 'PATCH', body: { active: false } }),
      params({ id: admin.id }),
    );
    expect(response.status).toBe(409);
  });

  it('empêche un administrateur de supprimer son propre compte', async () => {
    const admin = await prisma.user.create({
      data: { email: 'admin3@ceil.local', name: 'Admin', role: 'ADMIN', passwordHash: 'x' },
    });
    signIn('ADMIN', admin.id);

    const response = await deleteUser(request('', { method: 'DELETE' }), params({ id: admin.id }));
    expect(response.status).toBe(409);
  });

  it('autorise la modification d’un autre compte', async () => {
    const other = await prisma.user.create({
      data: { email: 'autre@ceil.local', name: 'Autre', role: 'USER', passwordHash: 'x' },
    });
    signIn('ADMIN', 'quelqu-un-dautre');

    const response = await patchUser(
      request('', { method: 'PATCH', body: { active: false } }),
      params({ id: other.id }),
    );
    expect(response.status).toBe(200);
  });
});
