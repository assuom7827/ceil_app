import { beforeEach, describe, expect, it } from 'vitest';
import {
  assignGroup,
  createAndEnroll,
  createParticipant,
  enroll,
  removeEnrollment,
} from '@/services/enrollment';
import { lockSession, unlockSession } from '@/services/locking';
import { ServiceError } from '@/services/errors';
import {
  createParticipants,
  createSession,
  createTraining,
  databaseAvailable,
  prisma,
  resetDatabase,
} from './helpers';

const hasDb = await databaseAvailable();

/** Vérifie le code métier ET le statut HTTP porté par l'erreur. */
async function expectServiceError(promise: Promise<unknown>, code: string, status: number) {
  await expect(promise).rejects.toBeInstanceOf(ServiceError);
  await promise.catch((error: ServiceError) => {
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
  });
}

describe.skipIf(!hasDb)('inscription simplifiée', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('inscrit une sélection en une seule action et attribue les matricules', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id, { matriculePrefix: 'CEIL-ANG' });
    const participants = await createParticipants(3);

    const result = await enroll(
      prisma,
      session.id,
      participants.map((p) => p.id),
    );

    expect(result).toMatchObject({ created: 3, skipped: 0 });

    const enrollments = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id },
      orderBy: { registrationNumber: 'asc' },
    });
    expect(enrollments.map((e) => e.registrationNumber)).toEqual([
      'CEIL-ANG-0001',
      'CEIL-ANG-0002',
      'CEIL-ANG-0003',
    ]);
  });

  it('ignore les doublons au lieu d’échouer', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const participants = await createParticipants(2);
    const ids = participants.map((p) => p.id);

    await enroll(prisma, session.id, ids);
    const second = await enroll(prisma, session.id, ids);

    expect(second).toMatchObject({ created: 0, skipped: 2 });
    expect(await prisma.enrollment.count({ where: { trainingSessionId: session.id } })).toBe(2);
  });

  it('n’inscrit que les manquants dans une sélection mixte', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [a, b, c] = await createParticipants(3);

    await enroll(prisma, session.id, [a!.id]);
    const result = await enroll(prisma, session.id, [a!.id, b!.id, c!.id]);

    expect(result).toMatchObject({ created: 2, skipped: 1 });
  });

  it('dédoublonne les identifiants répétés dans l’appel', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [participant] = await createParticipants(1);

    const result = await enroll(prisma, session.id, [
      participant!.id,
      participant!.id,
      participant!.id,
    ]);

    expect(result.created).toBe(1);
  });

  it('refuse une sélection vide (400)', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    await expectServiceError(enroll(prisma, session.id, []), 'VALIDATION', 400);
  });

  it('refuse un participant inexistant sans rien inscrire (404)', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [participant] = await createParticipants(1);

    await expectServiceError(
      enroll(prisma, session.id, [participant!.id, 'identifiant-inconnu']),
      'NOT_FOUND',
      404,
    );
    // La transaction a tout annulé : aucune inscription partielle.
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it('refuse d’inscrire dans une session verrouillée (409)', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [participant] = await createParticipants(1);

    await lockSession(prisma, session.id);
    await expectServiceError(enroll(prisma, session.id, [participant!.id]), 'LOCKED', 409);

    await unlockSession(prisma, session.id);
    await expect(enroll(prisma, session.id, [participant!.id])).resolves.toMatchObject({
      created: 1,
    });
  });

  it('crée un participant à la volée puis l’inscrit', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);

    const { participant, enrollment } = await createAndEnroll(prisma, session.id, {
      familyName: 'BENALI',
      firstName: 'Amina',
      phone: '0550000000',
    });

    expect(participant.registrationNumber).toMatch(/^PART-ETU-\d{4}-\d{4}$/);
    expect(enrollment.created).toBe(1);
    expect(await prisma.enrollment.count({ where: { participantId: participant.id } })).toBe(1);
  });

  it('refuse un participant sans aucun nom (400)', async () => {
    await expectServiceError(createParticipant(prisma, { phone: '05' }), 'VALIDATION', 400);
  });

  it('accepte un participant identifié uniquement en arabe', async () => {
    const participant = await createParticipant(prisma, { arabName: 'بن علي' });
    expect(participant.arabName).toBe('بن علي');
  });
});

describe.skipIf(!hasDb)('retrait et affectation de groupe', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('retire une inscription', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [participant] = await createParticipants(1);
    await enroll(prisma, session.id, [participant!.id]);

    const enrollment = await prisma.enrollment.findFirstOrThrow();
    await removeEnrollment(prisma, enrollment.id);

    expect(await prisma.enrollment.count()).toBe(0);
  });

   it('refuse le retrait dans une session verrouillée (409)', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [participant] = await createParticipants(1);
    await enroll(prisma, session.id, [participant!.id]);
    const enrollment = await prisma.enrollment.findFirstOrThrow();

    await lockSession(prisma, session.id);
    await expectServiceError(removeEnrollment(prisma, enrollment.id), 'LOCKED', 409);
    expect(await prisma.enrollment.count()).toBe(1);
  });

  it('refuse le retrait par un USER non-admin (403)', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [participant] = await createParticipants(1);
    await enroll(prisma, session.id, [participant!.id]);
    const enrollment = await prisma.enrollment.findFirstOrThrow();

    await expectServiceError(
      removeEnrollment(prisma, enrollment.id, 'user-id', 'USER'),
      'FORBIDDEN',
      403,
    );
    expect(await prisma.enrollment.count()).toBe(1);
  });

  it('refuse le retrait par un MANAGER non-admin (403)', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [participant] = await createParticipants(1);
    await enroll(prisma, session.id, [participant!.id]);
    const enrollment = await prisma.enrollment.findFirstOrThrow();

    await expectServiceError(
      removeEnrollment(prisma, enrollment.id, 'mgr-id', 'MANAGER'),
      'FORBIDDEN',
      403,
    );
    expect(await prisma.enrollment.count()).toBe(1);
  });

  it('autorise le retrait par un ADMIN', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const [participant] = await createParticipants(1);
    await enroll(prisma, session.id, [participant!.id]);
    const enrollment = await prisma.enrollment.findFirstOrThrow();

    await removeEnrollment(prisma, enrollment.id, 'admin-id', 'ADMIN');
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it('affecte un groupe en masse', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const participants = await createParticipants(3);
    await enroll(
      prisma,
      session.id,
      participants.map((p) => p.id),
    );

    const group = await prisma.studentGroup.create({
      data: { name: 'Groupe 1', groupType: 'SESSION', trainingSessionId: session.id },
    });
    const enrollments = await prisma.enrollment.findMany();

    const result = await assignGroup(
      prisma,
      session.id,
      enrollments.map((e) => e.id),
      'SESSION',
      group.id,
    );

    expect(result.updated).toBe(3);
    expect(await prisma.enrollment.count({ where: { sessionGroupId: group.id } })).toBe(3);
  });

  it('refuse un groupe étranger à la session (404)', async () => {
    const { training } = await createTraining();
    const session = await createSession(training.id);
    const other = await createSession(training.id);
    const foreignGroup = await prisma.studentGroup.create({
      data: { name: 'Ailleurs', groupType: 'SESSION', trainingSessionId: other.id },
    });

    await expectServiceError(
      assignGroup(prisma, session.id, [], 'SESSION', foreignGroup.id),
      'NOT_FOUND',
      404,
    );
  });
});
