/**
 * Inscription simplifiée — une seule action, pas d'étape intermédiaire de lot.
 *
 * `enroll(sessionId, participantIds)` crée les inscriptions manquantes, ignore
 * silencieusement celles qui existent déjà (garanties par la contrainte
 * `@@unique([participantId, trainingSessionId])`) et alloue les matricules.
 */
import type { Db } from './db';
import { withTransaction } from './db';
import { conflictError, notFoundError, validationError } from './errors';
import { assertSessionWritable } from './locking';
import { allocateEnrollmentRegistrationNumber } from './registration-numbers';
import { allocateParticipantRegistrationNumber } from './registration-numbers';
import type { ParticipantTypeLike } from './derive';

export type EnrollmentKindLike = 'NEW' | 'RETURNING';

export interface EnrollResult {
  /** Inscriptions créées par cet appel. */
  created: number;
  /** Participants déjà inscrits, volontairement ignorés. */
  skipped: number;
  /** Identifiants des participants concernés par une création. */
  createdParticipantIds: string[];
  skippedParticipantIds: string[];
}

export interface EnrollOptions {
  kind?: EnrollmentKindLike;
  responsible?: string | null;
}

/**
 * Inscrit une liste de participants à une session.
 *
 * Refuse si la session est verrouillée (409) ou si un identifiant de
 * participant n'existe pas (404) — inscrire partiellement une sélection
 * masquerait une erreur de saisie.
 */
export async function enroll(
  db: Db,
  trainingSessionId: string,
  participantIds: readonly string[],
  options: EnrollOptions = {},
): Promise<EnrollResult> {
  const uniqueIds = [...new Set(participantIds.filter((id) => id.trim().length > 0))];
  if (uniqueIds.length === 0) {
    throw validationError('Aucun participant sélectionné.');
  }

  await assertSessionWritable(db, trainingSessionId);

  return withTransaction(db, async (tx) => {
    const session = await tx.trainingSession.findUnique({
      where: { id: trainingSessionId },
      select: { id: true, matriculePrefix: true },
    });
    if (!session) {
      throw notFoundError('Session de formation introuvable.', { trainingSessionId });
    }

    const participants = await tx.participant.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (participants.length !== uniqueIds.length) {
      const found = new Set(participants.map((p) => p.id));
      throw notFoundError('Certains participants sélectionnés sont introuvables.', {
        missing: uniqueIds.filter((id) => !found.has(id)),
      });
    }

    const existing = await tx.enrollment.findMany({
      where: { trainingSessionId, participantId: { in: uniqueIds } },
      select: { participantId: true },
    });
    const alreadyEnrolled = new Set(existing.map((e) => e.participantId));
    const toCreate = uniqueIds.filter((id) => !alreadyEnrolled.has(id));

    for (const participantId of toCreate) {
      await tx.enrollment.create({
        data: {
          participantId,
          trainingSessionId,
          kind: options.kind ?? 'NEW',
          responsible: options.responsible ?? null,
          registrationNumber: await allocateEnrollmentRegistrationNumber(tx, session),
        },
      });
    }

    return {
      created: toCreate.length,
      skipped: alreadyEnrolled.size,
      createdParticipantIds: toCreate,
      skippedParticipantIds: [...alreadyEnrolled],
    };
  });
}

// ---------------------------------------------------------------------------
// Création de participant à la volée (mini-formulaire du dialogue d'inscription)
// ---------------------------------------------------------------------------

export interface QuickParticipantInput {
  familyName?: string | null;
  firstName?: string | null;
  arabName?: string | null;
  arabFirstName?: string | null;
  type?: ParticipantTypeLike;
  phone?: string | null;
  email?: string | null;
}

/**
 * Crée un participant avec son matricule. Utilisé par le mini-formulaire inline
 * du dialogue d'inscription et par l'import de masse.
 */
export async function createParticipant(db: Db, input: QuickParticipantInput) {
  const familyName = input.familyName?.trim() || null;
  const firstName = input.firstName?.trim() || null;
  const arabName = input.arabName?.trim() || null;

  if (!familyName && !firstName && !arabName) {
    throw validationError('Un participant doit avoir au moins un nom.');
  }

  const type: ParticipantTypeLike = input.type ?? 'STUDENT';

  return db.participant.create({
    data: {
      type,
      familyName,
      firstName,
      arabName,
      arabFirstName: input.arabFirstName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      registrationNumber: await allocateParticipantRegistrationNumber(db, type),
    },
  });
}

/** Crée un participant puis l'inscrit immédiatement — le geste du dialogue. */
export async function createAndEnroll(
  db: Db,
  trainingSessionId: string,
  input: QuickParticipantInput,
  options: EnrollOptions = {},
) {
  await assertSessionWritable(db, trainingSessionId);

  return withTransaction(db, async (tx) => {
    const participant = await createParticipant(tx, input);
    const result = await enroll(tx, trainingSessionId, [participant.id], options);
    if (result.created !== 1) {
      // Impossible en pratique : le participant vient d'être créé.
      throw conflictError('Le participant créé n’a pas pu être inscrit.', { participant });
    }
    return { participant, enrollment: result };
  });
}

// ---------------------------------------------------------------------------
// Retrait
// ---------------------------------------------------------------------------

/** Retire une inscription. Refuse si la session est verrouillée (409). */
export async function removeEnrollment(db: Db, enrollmentId: string): Promise<void> {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { trainingSessionId: true },
  });
  if (!enrollment) {
    throw notFoundError('Inscription introuvable.', { enrollmentId });
  }
  await assertSessionWritable(db, enrollment.trainingSessionId);
  await db.enrollment.delete({ where: { id: enrollmentId } });
}

/** Affecte en masse un groupe (session ou examen) à des inscriptions. */
export async function assignGroup(
  db: Db,
  trainingSessionId: string,
  enrollmentIds: readonly string[],
  groupType: 'SESSION' | 'EXAM',
  groupId: string | null,
): Promise<{ updated: number }> {
  await assertSessionWritable(db, trainingSessionId);

  if (groupId) {
    const group = await db.studentGroup.findFirst({
      where: { id: groupId, trainingSessionId, groupType, isTemplate: false },
      select: { id: true },
    });
    if (!group) {
      throw notFoundError('Groupe introuvable dans cette session.', { groupId, groupType });
    }
  }

  const { count } = await db.enrollment.updateMany({
    where: { id: { in: [...enrollmentIds] }, trainingSessionId },
    data: groupType === 'SESSION' ? { sessionGroupId: groupId } : { examGroupId: groupId },
  });

  return { updated: count };
}
