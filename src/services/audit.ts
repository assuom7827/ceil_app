import type { Db } from './db';

export interface AuditLogInput {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

export async function logAudit(db: Db, input: AuditLogInput): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue as never,
      newValue: input.newValue as never,
      ipAddress: input.ipAddress,
    },
  });
}

export const ACTION_SESSION_AGENT_ADDED = 'SESSION_AGENT_ADDED';
export const ACTION_SESSION_AGENT_REMOVED = 'SESSION_AGENT_REMOVED';
