/**
 * Invariants du modèle de diplôme — impossibles à exprimer en contrainte de
 * base, donc rétablis par l'API après chaque écriture.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocked = vi.hoisted(() => ({
  session: { user: { id: 'u', role: 'MANAGER' } } as { user: { id: string; role: string } } | null,
}));

vi.mock('@/auth', () => ({ auth: async () => mocked.session }));

import { POST as createModel } from '@/app/api/diploma-models/route';
import { PATCH as patchModel } from '@/app/api/diploma-models/[id]/route';
import { databaseAvailable, prisma } from './helpers';

const hasDb = await databaseAvailable();

function request(body?: unknown, method = 'POST') {
  return new NextRequest('http://localhost/api/diploma-models', {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  });
}

function params<T extends object>(value: T) {
  return { params: Promise.resolve(value) };
}

async function create(name: string, isDefault: boolean) {
  const response = await createModel(request({ name, isDefault }), params({}));
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; isDefault: boolean };
}

describe.skipIf(!hasDb)('modèle de diplôme par défaut', () => {
  beforeEach(async () => {
    await prisma.diplomaModel.deleteMany();
  });

  it('n’autorise qu’un seul modèle par défaut', async () => {
    await create('Modèle A', true);
    await create('Modèle B', true);

    const defaults = await prisma.diplomaModel.findMany({ where: { isDefault: true } });
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.name).toBe('Modèle B');
  });

  it('transfère le défaut lors d’une modification', async () => {
    const first = await create('Modèle A', true);
    const second = await create('Modèle B', false);

    await patchModel(
      request({ name: 'Modèle B', isDefault: true }, 'PATCH'),
      params({ id: second.id }),
    );

    const models = await prisma.diplomaModel.findMany({ orderBy: { name: 'asc' } });
    expect(models.find((m) => m.id === first.id)?.isDefault).toBe(false);
    expect(models.find((m) => m.id === second.id)?.isDefault).toBe(true);
  });

  /** Un modèle désactivé ne doit jamais rester le modèle par défaut. */
  it('retire le défaut d’un modèle désactivé', async () => {
    const model = await create('Modèle A', true);

    const response = await patchModel(
      request({ name: 'Modèle A', isDefault: true, disabled: true }, 'PATCH'),
      params({ id: model.id }),
    );

    // La réponse reflète l'état corrigé, pas l'état demandé.
    expect(await response.json()).toMatchObject({ isDefault: false, disabled: true });
    const stored = await prisma.diplomaModel.findUniqueOrThrow({ where: { id: model.id } });
    expect(stored.isDefault).toBe(false);
  });

  it('laisse aucun défaut si le seul modèle est désactivé', async () => {
    const model = await create('Modèle unique', true);
    await patchModel(
      request({ name: 'Modèle unique', disabled: true, isDefault: true }, 'PATCH'),
      params({ id: model.id }),
    );

    expect(await prisma.diplomaModel.count({ where: { isDefault: true } })).toBe(0);
  });
});
