import { describe, expect, it } from 'vitest';
import {
  assertCanRead,
  assertCanWrite,
  canRead,
  canWrite,
  hasFullAccess,
  type Actor,
  type Resource,
} from '@/services/rbac';
import { ServiceError } from '@/services/errors';

const manager: Actor = { id: 'm', role: 'MANAGER' };
const admin: Actor = { id: 'a', role: 'ADMIN' };
const user: Actor = { id: 'u', role: 'USER' };

const BUSINESS_RESOURCES: Resource[] = [
  'Participant',
  'TrainingSession',
  'Enrollment',
  'StudentGroup',
  'PositioningTest',
  'PositioningScore',
  'DeliberationEntry',
  'Faculty',
  'Speciality',
  'Teacher',
  'StudentCategory',
  'DiplomaModel',
];

const USER_WRITABLE_RESOURCES: Resource[] = [
  'Enrollment',
  'Participant',
  'PositioningScore',
  'DeliberationEntry',
  'PaymentReceipt',
];

describe('RBAC', () => {
  it('accorde le CRUD complet à MANAGER et ADMIN', () => {
    expect(hasFullAccess('MANAGER')).toBe(true);
    expect(hasFullAccess('ADMIN')).toBe(true);
    expect(hasFullAccess('USER')).toBe(false);

    for (const resource of [...BUSINESS_RESOURCES, 'Training', 'TrainingLevel', 'PaymentReceipt', 'AuditLog'] as Resource[]) {
      expect(canWrite(manager, resource), resource).toBe(true);
      expect(canWrite(admin, resource), resource).toBe(true);
    }
  });

  it('réserve l\'écriture d\'AuditLog et de User à ADMIN / MANAGER', () => {
    expect(canWrite(user, 'AuditLog')).toBe(false);
    expect(canWrite(user, 'User')).toBe(false);
    expect(canWrite(manager, 'AuditLog')).toBe(true);
    expect(canWrite(manager, 'User')).toBe(false);
    expect(canRead(manager, 'AuditLog')).toBe(true);
    expect(canRead(user, 'AuditLog')).toBe(false);
  });

  it('autorise USER à écrire uniquement les ressources métier courantes', () => {
    for (const resource of USER_WRITABLE_RESOURCES) {
      expect(canWrite(user, resource), resource).toBe(true);
    }

    for (const resource of BUSINESS_RESOURCES) {
      if (!USER_WRITABLE_RESOURCES.includes(resource)) {
        expect(canWrite(user, resource), resource).toBe(false);
      }
    }

    expect(canWrite(user, 'Training')).toBe(false);
    expect(canWrite(user, 'TrainingLevel')).toBe(false);
    expect(canWrite(user, 'PaymentReceipt')).toBe(true);
  });

  it('réserve la gestion des comptes à ADMIN', () => {
    expect(canWrite(admin, 'User')).toBe(true);
    expect(canWrite(manager, 'User')).toBe(false);
    expect(canRead(manager, 'User')).toBe(false);
    expect(canWrite(user, 'User')).toBe(false);
  });

  it('refuse tout à un visiteur non authentifié', () => {
    expect(canRead(null, 'Participant')).toBe(false);
    expect(canWrite(undefined, 'Participant')).toBe(false);
  });

  it('lève 401 sans acteur et 403 sur droit manquant', () => {
    expect(() => assertCanWrite(null, 'Participant')).toThrowError(ServiceError);

    try {
      assertCanWrite(null, 'Participant');
    } catch (error) {
      expect((error as ServiceError).status).toBe(401);
      expect((error as ServiceError).code).toBe('UNAUTHORIZED');
    }

    try {
      assertCanWrite(user, 'Training');
    } catch (error) {
      expect((error as ServiceError).status).toBe(403);
      expect((error as ServiceError).code).toBe('FORBIDDEN');
      expect((error as ServiceError).details).toMatchObject({
        resource: 'Training',
        role: 'USER',
      });
    }
  });

  it('laisse passer une action autorisée', () => {
    expect(() => assertCanWrite(user, 'Enrollment')).not.toThrow();
    expect(() => assertCanRead(user, 'Training')).not.toThrow();
    expect(() => assertCanWrite(manager, 'PaymentReceipt')).not.toThrow();
  });
});
