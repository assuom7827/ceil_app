import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  isTransitionAllowed,
  type EnrollmentStatusLike,
} from '@/services/enrollmentStatus';

const ALL_STATUSES: EnrollmentStatusLike[] = [
  'PENDING',
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
];

describe('ALLOWED_TRANSITIONS', () => {
  it('définit une entrée pour chaque statut', () => {
    for (const status of ALL_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('PENDING → CONFIRMED, CANCELLED, REJECTED', () => {
    expect(ALLOWED_TRANSITIONS.PENDING).toEqual(['CONFIRMED', 'CANCELLED', 'REJECTED']);
  });

  it('CONFIRMED → ACTIVE, CANCELLED', () => {
    expect(ALLOWED_TRANSITIONS.CONFIRMED).toEqual(['ACTIVE', 'CANCELLED']);
  });

  it('ACTIVE → COMPLETED, CANCELLED', () => {
    expect(ALLOWED_TRANSITIONS.ACTIVE).toEqual(['COMPLETED', 'CANCELLED']);
  });

  it('les statuts terminaux n’ont aucune transition sortante', () => {
    expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.REJECTED).toEqual([]);
  });
});

describe('isTransitionAllowed', () => {
  const allowed: Array<[EnrollmentStatusLike, EnrollmentStatusLike]> = [
    ['PENDING', 'CONFIRMED'],
    ['PENDING', 'CANCELLED'],
    ['PENDING', 'REJECTED'],
    ['CONFIRMED', 'ACTIVE'],
    ['CONFIRMED', 'CANCELLED'],
    ['ACTIVE', 'COMPLETED'],
    ['ACTIVE', 'CANCELLED'],
  ];

  it.each(allowed)('%s → %s est autorisée', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(true);
  });

  const refused: Array<[EnrollmentStatusLike, EnrollmentStatusLike]> = [
    ['PENDING', 'ACTIVE'],
    ['PENDING', 'COMPLETED'],
    ['CONFIRMED', 'PENDING'],
    ['CONFIRMED', 'REJECTED'],
    ['CONFIRMED', 'COMPLETED'],
    ['ACTIVE', 'PENDING'],
    ['ACTIVE', 'CONFIRMED'],
    ['ACTIVE', 'REJECTED'],
    ['COMPLETED', 'CANCELLED'],
    ['CANCELLED', 'CONFIRMED'],
    ['REJECTED', 'PENDING'],
  ];

  it.each(refused)('%s → %s est refusée', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(false);
  });

  it('un statut vers lui-même est refusé', () => {
    for (const status of ALL_STATUSES) {
      expect(isTransitionAllowed(status, status)).toBe(false);
    }
  });
});
