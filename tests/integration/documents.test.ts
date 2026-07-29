/**
 * Documents officiels : les valeurs imprimées doivent être EXACTEMENT celles
 * de la délibération. Un diplôme qui afficherait un total différent de la
 * grille serait un document faux.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { upsertDeliberationEntry } from '@/services/deliberation';
import {
  getAttestationDocument,
  getDiplomaDocument,
  getGroupListDocument,
  getMinutesDocument,
} from '@/services/documents';
import { enroll } from '@/services/enrollment';
import { assignGroupsByLevel, organizeGroupsByLevel } from '@/services/groups';
import {
  createGroupTemplate,
  createParticipants,
  createTraining,
  databaseAvailable,
  prisma,
  resetDatabase,
} from './helpers';

const hasDb = await databaseAvailable();

async function setup(options: { threshold?: number; dateTo?: Date } = {}) {
  const { training, levels } = await createTraining();
  const session = await prisma.trainingSession.create({
    data: {
      trainingId: training.id,
      academicYear: '2025-2026',
      admissionThreshold: options.threshold ?? 50,
      matriculePrefix: 'CEIL-ANG',
      dateFrom: new Date('2025-10-01'),
      dateTo: options.dateTo ?? new Date('2026-06-15'),
    },
  });

  const participants = await createParticipants(3);
  await prisma.participant.update({
    where: { id: participants[0]!.id },
    data: {
      arabName: 'بن علي',
      arabFirstName: 'أمينة',
      birthDate: new Date('1998-03-05'),
      birthPlace: 'Mostaganem',
      arabBirthPlace: 'مستغانم',
    },
  });

  await enroll(
    prisma,
    session.id,
    participants.map((p) => p.id),
  );
  const enrollments = await prisma.enrollment.findMany({
    where: { trainingSessionId: session.id },
    orderBy: { registrationNumber: 'asc' },
  });

  return { session, training, levels, participants, enrollments };
}

describe.skipIf(!hasDb)('procès-verbal', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('reprend toutes les inscriptions avec leurs totaux et statuts', async () => {
    const { session, enrollments } = await setup({ threshold: 50 });
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, {
      oralExpression: 20,
      writtenExpression: 20,
      oralComprehension: 10,
      writtenComprehension: 10,
    }); // 60 → admis
    await upsertDeliberationEntry(prisma, session.id, enrollments[1]!.id, {
      oralExpression: 10,
    }); // 10 → ajourné

    const { header, people } = await getMinutesDocument(prisma, session.id);

    expect(people).toHaveLength(3);
    expect(people.filter((p) => p.status === 'ADMITTED')).toHaveLength(1);
    expect(people.filter((p) => p.status === 'REFUSED')).toHaveLength(1);
    expect(people.filter((p) => p.status === null)).toHaveLength(1);
    expect(header.admissionThreshold).toBe(50);
  });

  it('expose le mois de fin de session EN ARABE', async () => {
    const { session } = await setup({ dateTo: new Date('2026-06-15') });
    const { header } = await getMinutesDocument(prisma, session.id);

    // Convention algérienne : juin s'écrit « جوان ».
    expect(header.arabicMonthTo).toBe('جوان');
    expect(header.yearTo).toBe(2026);
  });

  it('retombe sur le modèle de diplôme par défaut', async () => {
    const { session } = await setup();
    await prisma.diplomaModel.create({
      data: { name: 'Défaut', isDefault: true, heading: '<p>CEIL</p>' },
    });

    const { header } = await getMinutesDocument(prisma, session.id);
    expect(header.model?.name).toBe('Défaut');
  });

  /** Un gabarit désactivé ne doit jamais être imprimé. */
  it('ignore un modèle désactivé attaché à la session', async () => {
    const { session } = await setup();
    const disabled = await prisma.diplomaModel.create({
      data: { name: 'Obsolète', disabled: true },
    });
    await prisma.diplomaModel.create({ data: { name: 'Actif', isDefault: true } });
    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { diplomaModelId: disabled.id },
    });

    const { header } = await getMinutesDocument(prisma, session.id);
    expect(header.model?.name).toBe('Actif');
  });
});

describe.skipIf(!hasDb)('diplômes', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('ne retient que les admis', async () => {
    const { session, enrollments } = await setup({ threshold: 50 });
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, { oralExpression: 80 });
    await upsertDeliberationEntry(prisma, session.id, enrollments[1]!.id, { oralExpression: 10 });

    const { people } = await getDiplomaDocument(prisma, session.id);
    expect(people).toHaveLength(1);
    expect(people[0]?.status).toBe('ADMITTED');
  });

  it('refuse un diplôme pour un participant ajourné (422)', async () => {
    const { session, enrollments } = await setup({ threshold: 50 });
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, { oralExpression: 10 });

    await expect(getDiplomaDocument(prisma, session.id, enrollments[0]!.id)).rejects.toMatchObject({
      code: 'UNPROCESSABLE',
      status: 422,
    });
  });

  it('distingue une inscription inconnue d’un refus métier (404)', async () => {
    const { session } = await setup();
    await expect(getDiplomaDocument(prisma, session.id, 'inconnu')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('porte les identités latine et arabe du participant', async () => {
    const { session, enrollments } = await setup({ threshold: 50 });
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, { oralExpression: 90 });

    const { people } = await getDiplomaDocument(prisma, session.id, enrollments[0]!.id);
    expect(people[0]).toMatchObject({
      arabicFullName: 'بن علي أمينة',
      birth: '05/03/1998',
      arabicBirthPlace: 'مستغانم',
      total: 90,
    });
    expect(people[0]?.fullName).toMatch(/^NOM\d+ Prenom\d+$/);
  });
});

describe.skipIf(!hasDb)('attestations et listes', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('délivre une attestation même à un ajourné', async () => {
    const { session, enrollments } = await setup({ threshold: 50 });
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, { oralExpression: 5 });

    const { people } = await getAttestationDocument(prisma, session.id, enrollments[0]!.id);
    expect(people).toHaveLength(1);
    expect(people[0]?.status).toBe('REFUSED');
  });

  it('limite la liste aux membres du groupe demandé', async () => {
    const { session, levels } = await setup();
    await prisma.enrollment.updateMany({
      where: { trainingSessionId: session.id },
      data: { assignedLevelId: levels[0]!.id },
    });
    await createGroupTemplate('SESSION', 1, 2, 'Groupe 1');
    await organizeGroupsByLevel(prisma, session.id, { capacity: 2 });
    await assignGroupsByLevel(prisma, session.id);

    const groups = await prisma.studentGroup.findMany({
      where: { trainingSessionId: session.id, isTemplate: false },
      orderBy: { sequence: 'asc' },
    });

    const first = await getGroupListDocument(prisma, session.id, groups[0]!.id);
    expect(first.people).toHaveLength(2);
    expect(first.group?.name).toBe('Groupe 1');

    // Sans groupe : toute la session.
    const all = await getGroupListDocument(prisma, session.id);
    expect(all.people).toHaveLength(3);
    expect(all.group).toBeNull();
  });

  it('refuse un groupe étranger à la session (404)', async () => {
    const { session } = await setup();
    await expect(getGroupListDocument(prisma, session.id, 'inconnu')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
