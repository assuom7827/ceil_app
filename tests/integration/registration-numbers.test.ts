import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  allocateEnrollmentRegistrationNumber,
  allocateParticipantRegistrationNumber,
  allocateReceiptNumber,
  counterScopes,
  nextSequenceValue,
} from '@/services/registration-numbers';
import { databaseAvailable, prisma, resetDatabase } from './helpers';

const hasDb = await databaseAvailable();

describe.skipIf(!hasDb)('allocation des matricules', () => {
  beforeAll(async () => {
    if (hasDb) await resetDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it('démarre à 1 puis incrémente', async () => {
    expect(await nextSequenceValue(prisma, 'TEST')).toBe(1);
    expect(await nextSequenceValue(prisma, 'TEST')).toBe(2);
    expect(await nextSequenceValue(prisma, 'TEST')).toBe(3);
  });

  it('cloisonne les compteurs par portée', async () => {
    await nextSequenceValue(prisma, 'A');
    await nextSequenceValue(prisma, 'A');
    expect(await nextSequenceValue(prisma, 'B')).toBe(1);
  });

  /**
   * Le point critique : sans `ON CONFLICT DO UPDATE … RETURNING`, deux
   * allocations simultanées liraient la même valeur et produiraient deux
   * matricules identiques.
   */
  it('ne produit aucun doublon sous 50 allocations simultanées', async () => {
    const values = await Promise.all(
      Array.from({ length: 50 }, () => nextSequenceValue(prisma, 'CONCURRENT')),
    );

    expect(new Set(values).size).toBe(50);
    expect(Math.min(...values)).toBe(1);
    expect(Math.max(...values)).toBe(50);
  });

  it('produit 50 matricules de participant distincts en parallèle', async () => {
    const numbers = await Promise.all(
      Array.from({ length: 50 }, () =>
        allocateParticipantRegistrationNumber(prisma, 'STUDENT', 2026),
      ),
    );
    expect(new Set(numbers).size).toBe(50);
    expect(numbers).toContain('PART-ETU-2026-0001');
    expect(numbers).toContain('PART-ETU-2026-0050');
  });

  it('sépare les compteurs étudiant et enseignant', async () => {
    expect(await allocateParticipantRegistrationNumber(prisma, 'STUDENT', 2026)).toBe(
      'PART-ETU-2026-0001',
    );
    expect(await allocateParticipantRegistrationNumber(prisma, 'TEACHER', 2026)).toBe(
      'PART-ENS-2026-0001',
    );
    expect(await allocateParticipantRegistrationNumber(prisma, 'STUDENT', 2026)).toBe(
      'PART-ETU-2026-0002',
    );
  });

  it('repart à 1 sur une nouvelle année', async () => {
    await allocateParticipantRegistrationNumber(prisma, 'STUDENT', 2026);
    expect(await allocateParticipantRegistrationNumber(prisma, 'STUDENT', 2027)).toBe(
      'PART-ETU-2027-0001',
    );
  });

  it('numérote les inscriptions avec le préfixe de la session', async () => {
    const session = { id: 'session-1', matriculePrefix: 'CEIL-ANG-B11' };
    expect(await allocateEnrollmentRegistrationNumber(prisma, session)).toBe('CEIL-ANG-B11-0001');
    expect(await allocateEnrollmentRegistrationNumber(prisma, session)).toBe('CEIL-ANG-B11-0002');
  });

  it('cloisonne les compteurs d’inscription par session', async () => {
    await allocateEnrollmentRegistrationNumber(prisma, { id: 's1', matriculePrefix: 'A' });
    expect(
      await allocateEnrollmentRegistrationNumber(prisma, { id: 's2', matriculePrefix: 'B' }),
    ).toBe('B-0001');
  });

  it('numérote les reçus par année', async () => {
    expect(await allocateReceiptNumber(prisma, 2026)).toBe('PAY-2026-0001');
    expect(await allocateReceiptNumber(prisma, 2026)).toBe('PAY-2026-0002');
  });

  it('nomme les portées de façon lisible en base', () => {
    expect(counterScopes.participant('STUDENT', 2026)).toBe('PART-ETU-2026');
    expect(counterScopes.enrollment('abc')).toBe('ENROLL-abc');
    expect(counterScopes.receipt(2026)).toBe('PAY-2026');
  });
});
