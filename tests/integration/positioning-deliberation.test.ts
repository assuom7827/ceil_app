import { beforeEach, describe, expect, it } from 'vitest';
import { enroll } from '@/services/enrollment';
import { lockPositioningTest, lockSession } from '@/services/locking';
import { getPositioningRows, resolveLevels } from '@/services/positioning';
import {
  computeAdmission,
  getAdmittedEnrollments,
  getDeliberation,
  upsertDeliberationEntry,
} from '@/services/deliberation';
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

/**
 * Monte une session avec `count` inscrits et, si demandé, un test de
 * positionnement portant une note par inscrit.
 */
async function setupSession(count: number, options: { threshold?: number } = {}) {
  const { training, levels } = await createTraining();
  const session = await createSession(training.id, { admissionThreshold: options.threshold ?? 50 });
  const participants = await createParticipants(count);
  await enroll(
    prisma,
    session.id,
    participants.map((p) => p.id),
  );
  const enrollments = await prisma.enrollment.findMany({
    where: { trainingSessionId: session.id },
    orderBy: { registrationNumber: 'asc' },
  });
  return { training, levels, session, participants, enrollments };
}

describe.skipIf(!hasDb)('positionnement', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('attribue le niveau résolu à chaque inscription', async () => {
    const { training, session, enrollments } = await setupSession(3);
    const test = await prisma.positioningTest.create({ data: { trainingId: training.id } });

    // Barème des fixtures : A1 [0,30[, A2 [30,50[, B1 [50,70[, B2 [70,101[
    const notes = [
      { enrollmentId: enrollments[0]!.id, writtenExpression: 10, writtenComprehension: 10 }, // 20 → A1
      { enrollmentId: enrollments[1]!.id, writtenExpression: 25, writtenComprehension: 25 }, // 50 → B1
      { enrollmentId: enrollments[2]!.id, writtenExpression: 40, writtenComprehension: 40 }, // 80 → B2
    ];
    for (const note of notes) {
      await prisma.positioningScore.create({ data: { ...note, positioningTestId: test.id } });
    }

    const result = await resolveLevels(prisma, test.id);
    expect(result).toMatchObject({ updated: 3, total: 3, unresolved: 0, skippedLocked: 0 });

    const updated = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id },
      orderBy: { registrationNumber: 'asc' },
      select: { assignedLevel: { select: { name: true } } },
    });
    expect(updated.map((e) => e.assignedLevel?.name)).toEqual(['A1', 'B1', 'B2']);
  });

  it('applique l’intervalle semi-ouvert : 50 va en B1, pas en A2', async () => {
    const { training, enrollments } = await setupSession(1);
    const test = await prisma.positioningTest.create({ data: { trainingId: training.id } });
    await prisma.positioningScore.create({
      data: {
        enrollmentId: enrollments[0]!.id,
        positioningTestId: test.id,
        writtenExpression: 50,
        writtenComprehension: 0,
      },
    });

    await resolveLevels(prisma, test.id);
    const enrollment = await prisma.enrollment.findFirstOrThrow({
      select: { assignedLevel: { select: { name: true } } },
    });
    expect(enrollment.assignedLevel?.name).toBe('B1');
  });

  it('compte les notes hors barème comme non résolues', async () => {
    const { training, enrollments } = await setupSession(2);
    const test = await prisma.positioningTest.create({ data: { trainingId: training.id } });
    await prisma.positioningScore.create({
      data: { enrollmentId: enrollments[0]!.id, positioningTestId: test.id }, // aucune note
    });
    await prisma.positioningScore.create({
      data: {
        enrollmentId: enrollments[1]!.id,
        positioningTestId: test.id,
        writtenExpression: 200, // hors barème
        writtenComprehension: 0,
      },
    });

    expect(await resolveLevels(prisma, test.id)).toMatchObject({
      updated: 0,
      total: 2,
      unresolved: 2,
    });
  });

  it('ne recompte pas une attribution identique', async () => {
    const { training, enrollments } = await setupSession(1);
    const test = await prisma.positioningTest.create({ data: { trainingId: training.id } });
    await prisma.positioningScore.create({
      data: {
        enrollmentId: enrollments[0]!.id,
        positioningTestId: test.id,
        writtenExpression: 30,
        writtenComprehension: 30,
      },
    });

    expect((await resolveLevels(prisma, test.id)).updated).toBe(1);
    expect((await resolveLevels(prisma, test.id)).updated).toBe(0);
  });

  it('ignore les notes dont la session est verrouillée', async () => {
    const { training, session, enrollments } = await setupSession(1);
    const test = await prisma.positioningTest.create({ data: { trainingId: training.id } });
    await prisma.positioningScore.create({
      data: {
        enrollmentId: enrollments[0]!.id,
        positioningTestId: test.id,
        writtenExpression: 30,
        writtenComprehension: 30,
      },
    });
    await lockSession(prisma, session.id);

    expect(await resolveLevels(prisma, test.id)).toMatchObject({
      updated: 0,
      total: 1,
      skippedLocked: 1,
    });
  });

  it('refuse la résolution sur un test verrouillé (409)', async () => {
    const { training } = await setupSession(1);
    const test = await prisma.positioningTest.create({ data: { trainingId: training.id } });
    await lockPositioningTest(prisma, test.id);

    await expect(resolveLevels(prisma, test.id)).rejects.toMatchObject({
      code: 'LOCKED',
      status: 409,
    });
  });

  it('expose total et niveau résolu en colonnes calculées', async () => {
    const { training, enrollments } = await setupSession(1);
    const test = await prisma.positioningTest.create({ data: { trainingId: training.id } });
    await prisma.positioningScore.create({
      data: {
        enrollmentId: enrollments[0]!.id,
        positioningTestId: test.id,
        writtenExpression: 32,
        writtenComprehension: 28,
      },
    });

    const { rows } = await getPositioningRows(prisma, test.id);
    expect(rows[0]).toMatchObject({ total: 60 });
    expect(rows[0]?.resolvedLevel?.name).toBe('B1');
  });
});

describe.skipIf(!hasDb)('délibération', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('compte admis, ajournés et non délibérés', async () => {
    const { session, enrollments } = await setupSession(3, { threshold: 50 });

    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, {
      oralExpression: 15,
      writtenExpression: 15,
      oralComprehension: 15,
      writtenComprehension: 15,
    }); // 60 → admis
    await upsertDeliberationEntry(prisma, session.id, enrollments[1]!.id, {
      oralExpression: 10,
      writtenExpression: 10,
      oralComprehension: 10,
      writtenComprehension: 10,
    }); // 40 → ajourné
    // Le 3e reste sans note.

    expect(await computeAdmission(prisma, session.id)).toMatchObject({
      admitted: 1,
      refused: 1,
      pending: 1,
      total: 3,
      admissionThreshold: 50,
    });
  });

  it('admet exactement au seuil', async () => {
    const { session, enrollments } = await setupSession(1, { threshold: 50 });
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, {
      oralExpression: 50,
    });

    expect((await computeAdmission(prisma, session.id)).admitted).toBe(1);
  });

  it('respecte un seuil propre à la session', async () => {
    const { session, enrollments } = await setupSession(1, { threshold: 70 });
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, {
      oralExpression: 15,
      writtenExpression: 15,
      oralComprehension: 15,
      writtenComprehension: 15,
    }); // 60 < 70

    expect(await computeAdmission(prisma, session.id)).toMatchObject({ admitted: 0, refused: 1 });
  });

  it('ne persiste ni total ni statut', async () => {
    const { session, enrollments } = await setupSession(1);
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, { oralExpression: 60 });
    await computeAdmission(prisma, session.id);

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'deliberation_entries'
    `;
    const names = columns.map((c) => c.column_name);
    expect(names).not.toContain('total');
    expect(names).not.toContain('status');
    expect(names).not.toContain('noteTotal');
  });

  it('liste toutes les inscriptions, y compris sans notes', async () => {
    const { session, enrollments } = await setupSession(2);
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, { oralExpression: 60 });

    const deliberation = await getDeliberation(prisma, session.id);
    expect(deliberation.rows).toHaveLength(2);
    expect(deliberation.rows.filter((r) => r.status === null)).toHaveLength(1);
  });

  it('ne retient que les admis pour les diplômes', async () => {
    const { session, enrollments } = await setupSession(2);
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, { oralExpression: 80 });
    await upsertDeliberationEntry(prisma, session.id, enrollments[1]!.id, { oralExpression: 10 });

    const admitted = await getAdmittedEnrollments(prisma, session.id);
    expect(admitted).toHaveLength(1);
    expect(admitted[0]?.total).toBe(80);
  });

  it('refuse la saisie dans une session verrouillée (409)', async () => {
    const { session, enrollments } = await setupSession(1);
    await lockSession(prisma, session.id);

    await expect(
      upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, { oralExpression: 10 }),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, { oralExpression: 10 }),
    ).rejects.toMatchObject({ code: 'LOCKED', status: 409 });
  });

  it('refuse une inscription étrangère à la session (404)', async () => {
    const { session } = await setupSession(1);
    const other = await setupSession(1);

    await expect(
      upsertDeliberationEntry(prisma, session.id, other.enrollments[0]!.id, { oralExpression: 10 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
