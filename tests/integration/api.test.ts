/**
 * Tests de l'API : les Route Handlers sont appelés directement, avec une vraie
 * base et une session authentifiée simulée. On vérifie ce que le client voit —
 * le statut HTTP et le corps `{ error, message, details? }` — et pas seulement
 * le comportement des services, déjà couvert par ailleurs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Role } from '@/services/rbac';

const mocked = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string } } | null,
}));

vi.mock('@/auth', () => ({
  auth: async () => mocked.session,
}));

import { GET as listFaculties, POST as createFaculty } from '@/app/api/faculties/route';
import { GET as listTrainings, POST as createTraining } from '@/app/api/trainings/route';
import { POST as enrollRoute } from '@/app/api/sessions/[id]/enroll/route';
import { POST as lockRoute } from '@/app/api/sessions/[id]/lock/route';
import { POST as unlockRoute } from '@/app/api/sessions/[id]/unlock/route';
import {
  GET as getDeliberationRoute,
  PUT as saveDeliberationRoute,
} from '@/app/api/sessions/[id]/deliberation/route';
import { POST as recomputeRoute } from '@/app/api/sessions/[id]/deliberation/recompute/route';
import { GET as dashboardRoute } from '@/app/api/dashboard/stats/route';
import { enroll } from '@/services/enrollment';
import {
  createParticipants,
  createSession,
  createTraining as makeTraining,
  databaseAvailable,
  prisma,
  resetDatabase,
} from './helpers';

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

/** Les segments dynamiques arrivent sous forme de promesse dans Next 15. */
function params<T extends object>(value: T) {
  return { params: Promise.resolve(value) };
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe.skipIf(!hasDb)('API — authentification et RBAC', () => {
  beforeEach(async () => {
    await resetDatabase();
    signIn('MANAGER');
  });

  it('refuse un anonyme en 401', async () => {
    signIn(null);
    const response = await listFaculties(request('/api/faculties'), params({}));

    expect(response.status).toBe(401);
    expect(await bodyOf(response)).toMatchObject({ error: 'UNAUTHORIZED' });
  });

  it('refuse à USER l’écriture sur une ressource en lecture seule (403)', async () => {
    signIn('USER');
    const response = await createTraining(
      request('/api/trainings', { method: 'POST', body: { frName: 'Russe' } }),
      params({}),
    );

    expect(response.status).toBe(403);
    expect(await bodyOf(response)).toMatchObject({
      error: 'FORBIDDEN',
      details: { resource: 'Training', role: 'USER' },
    });
  });

  it('autorise USER à lire cette même ressource', async () => {
    signIn('USER');
    expect((await listTrainings(request('/api/trainings'), params({}))).status).toBe(200);
  });

  it('autorise MANAGER à écrire', async () => {
    const response = await createFaculty(
      request('/api/faculties', { method: 'POST', body: { name: 'Faculté des Langues' } }),
      params({}),
    );
    expect(response.status).toBe(201);
  });
});

describe.skipIf(!hasDb)('API — validation et conflits', () => {
  beforeEach(async () => {
    await resetDatabase();
    signIn('MANAGER');
  });

  it('renvoie 400 avec le champ fautif', async () => {
    const response = await createFaculty(
      request('/api/faculties', { method: 'POST', body: { name: '' } }),
      params({}),
    );

    expect(response.status).toBe(400);
    const body = await bodyOf(response);
    expect(body).toMatchObject({ error: 'VALIDATION' });
    expect(body['details']).toContainEqual({ path: 'name', message: 'Nom requis' });
  });

  it('renvoie 400 sur un corps JSON absent', async () => {
    const response = await createFaculty(
      new NextRequest('http://localhost/api/faculties', { method: 'POST' }),
      params({}),
    );
    expect(response.status).toBe(400);
  });

  /** Une violation d'unicité Prisma doit devenir un 409 lisible, pas un 500. */
  it('traduit une violation d’unicité en 409', async () => {
    const body = { name: 'Faculté en double' };
    await createFaculty(request('/api/faculties', { method: 'POST', body }), params({}));
    const second = await createFaculty(
      request('/api/faculties', { method: 'POST', body }),
      params({}),
    );

    expect(second.status).toBe(409);
    expect(await bodyOf(second)).toMatchObject({ error: 'CONFLICT' });
  });

  it('refuse un intervalle de niveau vide', async () => {
    const { POST } = await import('@/app/api/training-levels/route');
    const response = await POST(
      request('/api/training-levels', {
        method: 'POST',
        body: { name: 'X', sequence: 1, minimumPoints: 50, maximumPoints: 50 },
      }),
      params({}),
    );

    expect(response.status).toBe(400);
    expect((await bodyOf(response))['details']).toContainEqual({
      path: 'maximumPoints',
      message: 'Le maximum doit être strictement supérieur au minimum',
    });
  });
});

describe.skipIf(!hasDb)('API — liste, recherche et pagination', () => {
  beforeEach(async () => {
    await resetDatabase();
    signIn('MANAGER');
    for (const name of ['Droit', 'Informatique', 'Langues étrangères']) {
      await prisma.faculty.create({ data: { name } });
    }
  });

  it('pagine et compte', async () => {
    const response = await listFaculties(request('/api/faculties?perPage=2'), params({}));
    const body = await bodyOf(response);

    expect((body['data'] as unknown[]).length).toBe(2);
    expect(body['meta']).toMatchObject({ page: 1, perPage: 2, total: 3, totalPages: 2 });
  });

  it('recherche sans tenir compte de la casse', async () => {
    const response = await listFaculties(request('/api/faculties?q=informa'), params({}));
    expect((await bodyOf(response))['meta']).toMatchObject({ total: 1 });
  });

  it('masque les éléments désactivés par défaut', async () => {
    await prisma.faculty.update({ where: { name: 'Droit' }, data: { disabled: true } });

    const hidden = await bodyOf(await listFaculties(request('/api/faculties'), params({})));
    expect(hidden['meta']).toMatchObject({ total: 2 });

    const shown = await bodyOf(
      await listFaculties(request('/api/faculties?includeDisabled=true'), params({})),
    );
    expect(shown['meta']).toMatchObject({ total: 3 });
  });
});

describe.skipIf(!hasDb)('API — inscription et verrouillage', () => {
  beforeEach(async () => {
    await resetDatabase();
    signIn('MANAGER');
  });

  async function setup() {
    const { training } = await makeTraining();
    const session = await createSession(training.id);
    const participants = await createParticipants(2);
    return { session, participants };
  }

  it('inscrit une sélection et crée un participant à la volée', async () => {
    const { session, participants } = await setup();

    const response = await enrollRoute(
      request(`/api/sessions/${session.id}/enroll`, {
        method: 'POST',
        body: {
          participantIds: participants.map((p) => p.id),
          newParticipants: [{ familyName: 'BENALI', firstName: 'Amina' }],
        },
      }),
      params({ id: session.id }),
    );

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toMatchObject({
      created: 3,
      skipped: 0,
      participantsCreated: 1,
    });
  });

  it('refuse une sélection vide en 400', async () => {
    const { session } = await setup();
    const response = await enrollRoute(
      request(`/api/sessions/${session.id}/enroll`, {
        method: 'POST',
        body: { participantIds: [], newParticipants: [] },
      }),
      params({ id: session.id }),
    );
    expect(response.status).toBe(400);
  });

  it('renvoie 409 quand la session est verrouillée', async () => {
    const { session, participants } = await setup();
    await lockRoute(request('', { method: 'POST' }), params({ id: session.id }));

    const response = await enrollRoute(
      request(`/api/sessions/${session.id}/enroll`, {
        method: 'POST',
        body: { participantIds: [participants[0]!.id] },
      }),
      params({ id: session.id }),
    );

    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ error: 'LOCKED' });
  });

  it('rouvre la session et laisse à nouveau inscrire', async () => {
    const { session, participants } = await setup();
    await lockRoute(request('', { method: 'POST' }), params({ id: session.id }));
    await unlockRoute(request('', { method: 'POST' }), params({ id: session.id }));

    const response = await enrollRoute(
      request('', { method: 'POST', body: { participantIds: [participants[0]!.id] } }),
      params({ id: session.id }),
    );
    expect(response.status).toBe(200);
  });

  it('renvoie 404 sur une session inconnue', async () => {
    const response = await lockRoute(request('', { method: 'POST' }), params({ id: 'inexistant' }));
    expect(response.status).toBe(404);
  });
});

describe.skipIf(!hasDb)('API — délibération', () => {
  beforeEach(async () => {
    await resetDatabase();
    signIn('MANAGER');
  });

  async function setupDeliberation() {
    const { training } = await makeTraining();
    const session = await createSession(training.id, { admissionThreshold: 50 });
    const participants = await createParticipants(2);
    await enroll(
      prisma,
      session.id,
      participants.map((p) => p.id),
    );
    const enrollments = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id },
      orderBy: { registrationNumber: 'asc' },
    });
    return { session, enrollments };
  }

  it('expose des colonnes calculées, pas des colonnes stockées', async () => {
    const { session, enrollments } = await setupDeliberation();

    await saveDeliberationRoute(
      request('', {
        method: 'PUT',
        body: {
          entries: [
            {
              enrollmentId: enrollments[0]!.id,
              oralExpression: 15,
              writtenExpression: 15,
              oralComprehension: 15,
              writtenComprehension: 15,
            },
          ],
        },
      }),
      params({ id: session.id }),
    );

    const body = await bodyOf(await getDeliberationRoute(request(''), params({ id: session.id })));
    const rows = body['rows'] as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ total: 60, status: 'ADMITTED' });
    // La seconde inscription n'a pas de note : ni admise, ni ajournée.
    expect(rows[1]).toMatchObject({ total: null, status: null });
  });

  it('recalcule l’admission sans rien persister', async () => {
    const { session, enrollments } = await setupDeliberation();
    await saveDeliberationRoute(
      request('', {
        method: 'PUT',
        body: { entries: [{ enrollmentId: enrollments[0]!.id, oralExpression: 80 }] },
      }),
      params({ id: session.id }),
    );

    const response = await recomputeRoute(
      request('', { method: 'POST' }),
      params({ id: session.id }),
    );
    expect(await bodyOf(response)).toMatchObject({
      admitted: 1,
      refused: 0,
      pending: 1,
      total: 2,
      admissionThreshold: 50,
    });
  });

  it('refuse l’enregistrement en masse sur une session verrouillée', async () => {
    const { session, enrollments } = await setupDeliberation();
    await lockRoute(request('', { method: 'POST' }), params({ id: session.id }));

    const response = await saveDeliberationRoute(
      request('', {
        method: 'PUT',
        body: { entries: [{ enrollmentId: enrollments[0]!.id, oralExpression: 10 }] },
      }),
      params({ id: session.id }),
    );

    expect(response.status).toBe(409);
    // Aucune ligne ne doit avoir été écrite avant l'échec.
    expect(await prisma.deliberationEntry.count()).toBe(0);
  });
});

describe.skipIf(!hasDb)('API — tableau de bord', () => {
  beforeEach(async () => {
    await resetDatabase();
    signIn('MANAGER');
  });

  it('agrège les compteurs et dérive les admis', async () => {
    const { training } = await makeTraining();
    const session = await createSession(training.id);
    const participants = await createParticipants(3);
    await enroll(
      prisma,
      session.id,
      participants.map((p) => p.id),
    );

    const body = await bodyOf(await dashboardRoute(request('/api/dashboard/stats'), params({})));

    expect(body).toMatchObject({
      participants: 3,
      sessions: { open: 1, locked: 0 },
      confirmedReceipts: 0,
    });
    expect((body['recentSessions'] as unknown[])[0]).toMatchObject({
      enrollments: 3,
      admitted: 0,
      pending: 3,
    });
  });
});
