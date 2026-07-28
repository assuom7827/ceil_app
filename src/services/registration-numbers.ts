/**
 * Allocation des matricules.
 *
 * L'incrément est fait par un unique `INSERT … ON CONFLICT DO UPDATE …
 * RETURNING`, donc atomique au niveau du moteur : deux allocations simultanées
 * ne peuvent pas obtenir le même numéro, même sans transaction englobante.
 * Un `SELECT` suivi d'un `UPDATE` ne donnerait pas cette garantie.
 */
import { randomUUID } from 'node:crypto';
import type { Db } from './db';
import {
  formatEnrollmentRegistrationNumber,
  formatParticipantRegistrationNumber,
  formatReceiptNumber,
  participantTypeSegment,
  type ParticipantTypeLike,
} from './derive';

/** Portées de compteur, nommées de façon stable et lisible en base. */
export const counterScopes = {
  participant: (type: ParticipantTypeLike, year: number) =>
    `PART-${participantTypeSegment(type)}-${year}`,
  enrollment: (trainingSessionId: string) => `ENROLL-${trainingSessionId}`,
  receipt: (year: number) => `PAY-${year}`,
} as const;

/**
 * Réserve et retourne la valeur suivante du compteur `scope`.
 * La première allocation retourne 1.
 */
export async function nextSequenceValue(db: Db, scope: string): Promise<number> {
  const rows = await db.$queryRaw<Array<{ value: number }>>`
    INSERT INTO sequence_counters ("id", "scope", "value", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${scope}, 1, now(), now())
    ON CONFLICT ("scope")
      DO UPDATE SET "value" = sequence_counters."value" + 1, "updatedAt" = now()
    RETURNING "value"
  `;

  const value = rows[0]?.value;
  if (typeof value !== 'number') {
    throw new Error(`Allocation du compteur « ${scope} » impossible.`);
  }
  return value;
}

/** `PART-ETU-{YYYY}-{n}` / `PART-ENS-{YYYY}-{n}`. */
export async function allocateParticipantRegistrationNumber(
  db: Db,
  type: ParticipantTypeLike,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const sequence = await nextSequenceValue(db, counterScopes.participant(type, year));
  return formatParticipantRegistrationNumber(type, year, sequence);
}

/** Matricule d'inscription, basé sur le `matriculePrefix` de la session. */
export async function allocateEnrollmentRegistrationNumber(
  db: Db,
  session: { id: string; matriculePrefix?: string | null },
): Promise<string> {
  const sequence = await nextSequenceValue(db, counterScopes.enrollment(session.id));
  return formatEnrollmentRegistrationNumber(session.matriculePrefix, sequence);
}

/** `PAY-{YYYY}-{n}`. */
export async function allocateReceiptNumber(
  db: Db,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const sequence = await nextSequenceValue(db, counterScopes.receipt(year));
  return formatReceiptNumber(year, sequence);
}
