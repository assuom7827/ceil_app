/**
 * Outillage des tests d'intégration.
 *
 * Ces tests s'exécutent sur une VRAIE base PostgreSQL : c'est le seul moyen de
 * vérifier ce qui compte ici — atomicité des compteurs, contrainte d'unicité
 * des inscriptions, `onDelete: SetNull` lors de la réorganisation des groupes.
 * Un mock de Prisma validerait le code contre lui-même, pas contre le moteur.
 *
 * Si aucune base n'est joignable, les suites concernées sont ignorées plutôt
 * que rouges : les tests unitaires purs, eux, tournent partout.
 */
import { PrismaClient } from '@prisma/client';
import { allocateParticipantRegistrationNumber } from '@/services/registration-numbers';

export const prisma = new PrismaClient();

/** Tables vidées entre deux tests, dans l'ordre inverse des dépendances. */
const TABLES_IN_DELETION_ORDER = [
  'audit_logs',
  'deliberation_entries',
  'positioning_scores',
  'payment_receipts',
  'enrollments',
  'positioning_tests',
  'student_groups',
  'training_sessions',
  'participants',
  'sequence_counters',
  'trainings',
  'training_levels',
  'diploma_models',
  'teachers',
  'student_categories',
  'specialities',
  'faculties',
] as const;

export async function databaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES_IN_DELETION_ORDER.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

// ---------------------------------------------------------------------------
// Fabriques
// ---------------------------------------------------------------------------

/** Barème CECRL réduit mais contigu, suffisant pour éprouver la résolution. */
export const LEVEL_FIXTURES = [
  { name: 'A1', sequence: 1, minimumPoints: 0, maximumPoints: 30 },
  { name: 'A2', sequence: 2, minimumPoints: 30, maximumPoints: 50 },
  { name: 'B1', sequence: 3, minimumPoints: 50, maximumPoints: 70 },
  { name: 'B2', sequence: 4, minimumPoints: 70, maximumPoints: 101 },
] as const;

export async function createTraining(withLevels = true) {
  // `upsert` : les niveaux ont un nom unique et sont partagés par toutes les
  // formations, la fabrique doit donc rester appelable plusieurs fois par test.
  const levels = withLevels
    ? await Promise.all(
        LEVEL_FIXTURES.map((level) =>
          prisma.trainingLevel.upsert({
            where: { name: level.name },
            update: {},
            create: { ...level },
          }),
        ),
      )
    : [];

  const training = await prisma.training.create({
    data: {
      frName: `Anglais ${Math.random().toString(36).slice(2, 8)}`,
      arName: 'الإنجليزية',
      levels: { connect: levels.map(({ id }) => ({ id })) },
    },
  });

  return { training, levels };
}

export async function createSession(
  trainingId: string,
  overrides: Partial<{
    admissionThreshold: number;
    matriculePrefix: string;
    state: 'OPEN' | 'LOCKED';
    academicYear: string;
  }> = {},
) {
  return prisma.trainingSession.create({
    data: {
      trainingId,
      academicYear: overrides.academicYear ?? '2025-2026',
      admissionThreshold: overrides.admissionThreshold ?? 50,
      matriculePrefix: overrides.matriculePrefix ?? 'CEIL-ANG',
      state: overrides.state ?? 'OPEN',
    },
  });
}

let participantCounter = 0;

/**
 * Les matricules passent par l'allocateur, comme en production : les forger à
 * la main désynchroniserait le compteur et provoquerait une collision au
 * premier participant créé par l'application.
 */
export async function createParticipants(count: number) {
  const participants = [];
  for (let i = 0; i < count; i += 1) {
    participantCounter += 1;
    participants.push(
      await prisma.participant.create({
        data: {
          familyName: `NOM${String(participantCounter).padStart(3, '0')}`,
          firstName: `Prenom${participantCounter}`,
          registrationNumber: await allocateParticipantRegistrationNumber(prisma, 'STUDENT'),
        },
      }),
    );
  }
  return participants;
}

export async function createGroupTemplate(
  groupType: 'SESSION' | 'EXAM',
  sequence: number,
  capacity: number | null,
  name = `${groupType}-${sequence}`,
  teacherId?: string,
) {
  return prisma.studentGroup.create({
    data: { name, groupType, sequence, capacity, isTemplate: true, teacherId },
  });
}
