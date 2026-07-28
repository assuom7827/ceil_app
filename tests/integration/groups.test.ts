import { beforeEach, describe, expect, it } from 'vitest';
import { enroll } from '@/services/enrollment';
import { assignExamGroups, getSessionGroups, organizeGroups } from '@/services/groups';
import { lockSession } from '@/services/locking';
import {
  createGroupTemplate,
  createParticipants,
  createSession,
  createTraining,
  databaseAvailable,
  prisma,
  resetDatabase,
} from './helpers';

const hasDb = await databaseAvailable();

async function sessionWithEnrollments(count: number) {
  const { training } = await createTraining();
  const session = await createSession(training.id);
  const participants = await createParticipants(count);
  if (count > 0) {
    await enroll(
      prisma,
      session.id,
      participants.map((p) => p.id),
    );
  }
  return session;
}

describe.skipIf(!hasDb)('organisation des groupes depuis les gabarits', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('instancie les gabarits en groupes réels, dans l’ordre de séquence', async () => {
    const session = await sessionWithEnrollments(0);
    await createGroupTemplate('SESSION', 2, 25, 'Groupe 2');
    await createGroupTemplate('SESSION', 1, 25, 'Groupe 1');

    const result = await organizeGroups(prisma, session.id, 'SESSION');
    expect(result).toMatchObject({ removed: 0, created: 2 });

    const groups = await prisma.studentGroup.findMany({
      where: { trainingSessionId: session.id, isTemplate: false },
      orderBy: { sequence: 'asc' },
    });
    expect(groups.map((g) => g.name)).toEqual(['Groupe 1', 'Groupe 2']);
    expect(groups.every((g) => g.isTemplate === false)).toBe(true);
  });

  it('ne touche pas aux gabarits eux-mêmes', async () => {
    const session = await sessionWithEnrollments(0);
    await createGroupTemplate('SESSION', 1, 25);
    await organizeGroups(prisma, session.id, 'SESSION');

    expect(await prisma.studentGroup.count({ where: { isTemplate: true } })).toBe(1);
  });

  it('ignore les gabarits désactivés et ceux d’un autre type', async () => {
    const session = await sessionWithEnrollments(0);
    await createGroupTemplate('SESSION', 1, 25);
    await createGroupTemplate('EXAM', 1, 40);
    const disabled = await createGroupTemplate('SESSION', 2, 25, 'Désactivé');
    await prisma.studentGroup.update({ where: { id: disabled.id }, data: { disabled: true } });

    expect(await organizeGroups(prisma, session.id, 'SESSION')).toMatchObject({ created: 1 });
  });

  it('remplace les groupes existants sans supprimer les inscriptions', async () => {
    const session = await sessionWithEnrollments(2);
    await createGroupTemplate('SESSION', 1, 25);
    await organizeGroups(prisma, session.id, 'SESSION');

    const group = await prisma.studentGroup.findFirstOrThrow({
      where: { trainingSessionId: session.id, isTemplate: false },
    });
    await prisma.enrollment.updateMany({
      where: { trainingSessionId: session.id },
      data: { sessionGroupId: group.id },
    });

    const result = await organizeGroups(prisma, session.id, 'SESSION');
    expect(result).toMatchObject({ removed: 1, created: 1 });

    // Les inscriptions survivent, leur groupe est simplement remis à null.
    const enrollments = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id },
    });
    expect(enrollments).toHaveLength(2);
    expect(enrollments.every((e) => e.sessionGroupId === null)).toBe(true);
  });

  it('refuse d’organiser dans une session verrouillée (409)', async () => {
    const session = await sessionWithEnrollments(0);
    await createGroupTemplate('SESSION', 1, 25);
    await lockSession(prisma, session.id);

    await expect(organizeGroups(prisma, session.id, 'SESSION')).rejects.toMatchObject({
      code: 'LOCKED',
      status: 409,
    });
  });
});

describe.skipIf(!hasDb)('répartition dans les groupes d’examen', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('remplit séquentiellement en respectant la capacité', async () => {
    const session = await sessionWithEnrollments(5);
    await createGroupTemplate('EXAM', 1, 2, 'Salle A');
    await createGroupTemplate('EXAM', 2, 2, 'Salle B');
    await createGroupTemplate('EXAM', 3, 10, 'Salle C');
    await organizeGroups(prisma, session.id, 'EXAM');

    const result = await assignExamGroups(prisma, session.id);

    expect(result).toMatchObject({ assigned: 5, unassigned: 0 });
    expect(result.occupancy.map((o) => [o.name, o.count])).toEqual([
      ['Salle A', 2],
      ['Salle B', 2],
      ['Salle C', 1],
    ]);
  });

  it('laisse sans groupe les inscrits en surnombre', async () => {
    const session = await sessionWithEnrollments(5);
    await createGroupTemplate('EXAM', 1, 2, 'Salle A');
    await organizeGroups(prisma, session.id, 'EXAM');

    expect(await assignExamGroups(prisma, session.id)).toMatchObject({
      assigned: 2,
      unassigned: 3,
    });
  });

  it('traite une capacité absente comme illimitée', async () => {
    const session = await sessionWithEnrollments(7);
    await createGroupTemplate('EXAM', 1, null, 'Salle libre');
    await organizeGroups(prisma, session.id, 'EXAM');

    expect(await assignExamGroups(prisma, session.id)).toMatchObject({
      assigned: 7,
      unassigned: 0,
    });
  });

  it('complète les groupes existants au lieu de les vider (relance)', async () => {
    const session = await sessionWithEnrollments(2);
    await createGroupTemplate('EXAM', 1, 3, 'Salle A');
    await organizeGroups(prisma, session.id, 'EXAM');
    await assignExamGroups(prisma, session.id);

    // Deux nouveaux inscrits arrivent après une première répartition.
    const newcomers = await createParticipants(2);
    await enroll(
      prisma,
      session.id,
      newcomers.map((p) => p.id),
    );

    const result = await assignExamGroups(prisma, session.id);
    expect(result).toMatchObject({ assigned: 1, unassigned: 1 });
    expect(result.occupancy[0]).toMatchObject({ name: 'Salle A', count: 3 });
  });

  it('refuse la répartition sans groupe d’examen (404)', async () => {
    const session = await sessionWithEnrollments(2);
    await expect(assignExamGroups(prisma, session.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('expose l’effectif de chaque groupe', async () => {
    const session = await sessionWithEnrollments(3);
    await createGroupTemplate('EXAM', 1, 10, 'Salle A');
    await organizeGroups(prisma, session.id, 'EXAM');
    await assignExamGroups(prisma, session.id);

    const groups = await getSessionGroups(prisma, session.id);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: 'Salle A', groupType: 'EXAM', count: 3 });
  });
});
