import { beforeEach, describe, expect, it } from 'vitest';
import { enroll } from '@/services/enrollment';
import { assignGroupsByLevel, getSessionGroups, organizeGroupsByLevel } from '@/services/groups';
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

/**
 * Session multi-niveaux : on inscrit `counts` participants par niveau et on
 * leur attribue le niveau correspondant, comme le ferait `resolveLevels()`
 * après le test de positionnement.
 */
async function sessionWithLeveledEnrollments(counts: Record<string, number>) {
  const { training, levels } = await createTraining();
  const session = await createSession(training.id);

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const participants = await createParticipants(total);
  await enroll(
    prisma,
    session.id,
    participants.map((p) => p.id),
  );

  const enrollments = await prisma.enrollment.findMany({
    where: { trainingSessionId: session.id },
    orderBy: { registrationNumber: 'asc' },
  });

  let cursor = 0;
  for (const [levelName, count] of Object.entries(counts)) {
    const level = levels.find((l) => l.name === levelName);
    if (!level) throw new Error(`Niveau ${levelName} absent des fixtures`);

    const slice = enrollments.slice(cursor, cursor + count);
    cursor += count;
    await prisma.enrollment.updateMany({
      where: { id: { in: slice.map((e) => e.id) } },
      data: { assignedLevelId: level.id },
    });
  }

  return { session, levels, enrollments };
}

describe.skipIf(!hasDb)('ouverture des groupes par niveau', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('ouvre autant de groupes que l’effectif l’exige, niveau par niveau', async () => {
    // Capacité 25 : A1 (60) → 3 groupes, B1 (30) → 2 groupes, B2 (10) → 1 groupe.
    const { session } = await sessionWithLeveledEnrollments({ A1: 60, B1: 30, B2: 10 });
    await createGroupTemplate('SESSION', 1, 25, 'Groupe 1');
    await createGroupTemplate('SESSION', 2, 25, 'Groupe 2');

    const result = await organizeGroupsByLevel(prisma, session.id);

    expect(result.capacity).toBe(25);
    expect(result.created).toBe(6);
    expect(result.byLevel).toEqual([
      { levelId: expect.any(String), levelName: 'A1', enrollments: 60, groups: 3 },
      { levelId: expect.any(String), levelName: 'B1', enrollments: 30, groups: 2 },
      { levelId: expect.any(String), levelName: 'B2', enrollments: 10, groups: 1 },
    ]);
  });

  it('nomme les groupes depuis les gabarits puis poursuit la numérotation', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 60 });
    await createGroupTemplate('SESSION', 1, 25, 'Groupe 1');
    await createGroupTemplate('SESSION', 2, 25, 'Groupe 2');

    await organizeGroupsByLevel(prisma, session.id);

    const groups = await prisma.studentGroup.findMany({
      where: { trainingSessionId: session.id, isTemplate: false },
      orderBy: { sequence: 'asc' },
      select: { name: true },
    });
    // Deux gabarits fournissent « Groupe 1 » et « Groupe 2 » ; le 3e est généré.
    expect(groups.map((g) => g.name)).toEqual(['Groupe 1', 'Groupe 2', 'Groupe 3']);
  });

  it('ouvre un groupe même pour un niveau très peu représenté', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 1 });
    await createGroupTemplate('SESSION', 1, 25);

    expect(await organizeGroupsByLevel(prisma, session.id)).toMatchObject({ created: 1 });
  });

  it('n’ouvre aucun groupe pour un niveau sans inscrit', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 5 });
    await createGroupTemplate('SESSION', 1, 25);

    const result = await organizeGroupsByLevel(prisma, session.id);
    expect(result.byLevel.map((l) => l.levelName)).toEqual(['A1']);
  });

  it('signale les inscrits sans niveau attribué', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 3 });
    const extra = await createParticipants(2);
    await enroll(
      prisma,
      session.id,
      extra.map((p) => p.id),
    ); // sans niveau : positionnement non fait
    await createGroupTemplate('SESSION', 1, 25);

    expect(await organizeGroupsByLevel(prisma, session.id)).toMatchObject({ withoutLevel: 2 });
  });

  it('accepte une capacité explicite qui prime sur le gabarit', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 30 });
    await createGroupTemplate('SESSION', 1, 25);

    const result = await organizeGroupsByLevel(prisma, session.id, { capacity: 10 });
    expect(result).toMatchObject({ capacity: 10, created: 3 });
  });

  it('refuse de deviner une capacité absente (400)', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 5 });
    await createGroupTemplate('SESSION', 1, null);

    await expect(organizeGroupsByLevel(prisma, session.id)).rejects.toMatchObject({
      code: 'VALIDATION',
      status: 400,
    });
  });

  it('remplace les groupes existants sans perdre les inscriptions', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 5 });
    await createGroupTemplate('SESSION', 1, 25);
    await organizeGroupsByLevel(prisma, session.id);
    await assignGroupsByLevel(prisma, session.id);

    const result = await organizeGroupsByLevel(prisma, session.id);
    expect(result).toMatchObject({ removed: 1, created: 1 });
    expect(await prisma.enrollment.count({ where: { trainingSessionId: session.id } })).toBe(5);
  });

  it('refuse dans une session verrouillée (409)', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 5 });
    await createGroupTemplate('SESSION', 1, 25);
    await lockSession(prisma, session.id);

    await expect(organizeGroupsByLevel(prisma, session.id)).rejects.toMatchObject({
       code: 'LOCKED',
       status: 409,
     });
   });

   it('copie l\'enseignant du gabarit sur chaque groupe ouvert — un enseignant pour plusieurs groupes', async () => {
     const { session } = await sessionWithLeveledEnrollments({ A1: 60, B1: 30 });
     const teacher = await prisma.teacher.create({
       data: { name: 'Dupont', teacherType: 'PERMANENT' },
     });

     await createGroupTemplate('SESSION', 1, 25, 'Groupe 1', teacher.id);
     await createGroupTemplate('SESSION', 2, 25, 'Groupe 2', teacher.id);

     await organizeGroupsByLevel(prisma, session.id);

     const groups = await prisma.studentGroup.findMany({
       where: { trainingSessionId: session.id, isTemplate: false },
       orderBy: { sequence: 'asc' },
       select: { teacherId: true, trainingLevel: { select: { name: true } } },
     });

     // 60 A1 / 25 capacité → 3 groupes ; 30 B1 / 25 → 2 groupes = 5 au total.
     expect(groups).toHaveLength(5);
     // Tous les groupes partagent le même enseignant (celui du gabarit).
     expect(groups.every((g) => g.teacherId === teacher.id)).toBe(true);
   });
 });

describe.skipIf(!hasDb)('répartition des inscrits par niveau', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('place chaque inscrit dans un groupe de SON niveau', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 30, B1: 10 });
    await createGroupTemplate('SESSION', 1, 25);
    await organizeGroupsByLevel(prisma, session.id);

    const result = await assignGroupsByLevel(prisma, session.id);
    expect(result).toMatchObject({ assigned: 40, unassigned: 0, withoutLevel: 0 });

    // Aucun inscrit ne se retrouve dans un groupe d'un autre niveau.
    const placed = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id, sessionGroupId: { not: null } },
      select: {
        assignedLevelId: true,
        sessionGroup: { select: { trainingLevelId: true } },
      },
    });
    expect(placed).toHaveLength(40);
    const mismatched = placed.filter((e) => e.sessionGroup?.trainingLevelId !== e.assignedLevelId);
    expect(mismatched).toHaveLength(0);
  });

  it('remplit les groupes d’un niveau dans l’ordre, sans dépasser la capacité', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 30 });
    await createGroupTemplate('SESSION', 1, 25, 'Groupe 1');
    await organizeGroupsByLevel(prisma, session.id);
    await assignGroupsByLevel(prisma, session.id);

    const groups = await getSessionGroups(prisma, session.id);
    expect(groups.map((g) => [g.name, g.count])).toEqual([
      ['Groupe 1', 25],
      ['Groupe 2', 5],
    ]);
  });

  it('laisse de côté les inscrits sans niveau attribué', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 3 });
    const extra = await createParticipants(2);
    await enroll(
      prisma,
      session.id,
      extra.map((p) => p.id),
    );
    await createGroupTemplate('SESSION', 1, 25);
    await organizeGroupsByLevel(prisma, session.id);

    expect(await assignGroupsByLevel(prisma, session.id)).toMatchObject({
      assigned: 3,
      withoutLevel: 2,
      unassigned: 0,
    });
  });

  it('signale les inscrits dont le niveau n’a plus de place', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 10 });
    await createGroupTemplate('SESSION', 1, 25);
    await organizeGroupsByLevel(prisma, session.id, { capacity: 4 }); // 3 groupes = 12 places

    // On réduit la capacité après coup : 10 inscrits pour 6 places.
    const groups = await prisma.studentGroup.findMany({
      where: { trainingSessionId: session.id, isTemplate: false },
      orderBy: { sequence: 'asc' },
    });
    await prisma.studentGroup.update({ where: { id: groups[2]!.id }, data: { disabled: true } });
    await prisma.studentGroup.update({ where: { id: groups[1]!.id }, data: { capacity: 2 } });

    expect(await assignGroupsByLevel(prisma, session.id)).toMatchObject({
      assigned: 6,
      unassigned: 4,
    });
  });

  it('complète les groupes existants lors d’une relance', async () => {
    const { session, levels } = await sessionWithLeveledEnrollments({ A1: 3 });
    await createGroupTemplate('SESSION', 1, 25);
    await organizeGroupsByLevel(prisma, session.id);
    await assignGroupsByLevel(prisma, session.id);

    const newcomers = await createParticipants(2);
    await enroll(
      prisma,
      session.id,
      newcomers.map((p) => p.id),
    );
    await prisma.enrollment.updateMany({
      where: { participantId: { in: newcomers.map((p) => p.id) } },
      data: { assignedLevelId: levels.find((l) => l.name === 'A1')!.id },
    });

    const result = await assignGroupsByLevel(prisma, session.id);
    expect(result.assigned).toBe(2);
    expect(result.occupancy[0]).toMatchObject({ levelName: 'A1', count: 5 });
  });

  it('refuse la répartition avant l’ouverture des groupes (404)', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 3 });
    await expect(assignGroupsByLevel(prisma, session.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('expose le niveau de chaque groupe', async () => {
    const { session } = await sessionWithLeveledEnrollments({ A1: 5, B1: 5 });
    await createGroupTemplate('SESSION', 1, 25);
    await organizeGroupsByLevel(prisma, session.id);

    const groups = await getSessionGroups(prisma, session.id);
    expect(groups.map((g) => g.trainingLevel?.name)).toEqual(['A1', 'B1']);
  });
});
