import { readJson, route } from '@/lib/api/handler';
import { enrollmentUpdateSchema } from '@/lib/validation/schemas';
import { removeEnrollment } from '@/services/enrollment';
import { assertEnrollmentWritable } from '@/services/locking';
import { logAudit } from '@/services/audit';

/** Édition d'une cellule de la grille des inscrits (niveau, groupe, type). */
export const PATCH = route<{ id: string }>(
  { resource: 'Enrollment', access: 'write' },
  async ({ db, params, request, actor }) => {
    const data = await readJson(request, enrollmentUpdateSchema);
    await assertEnrollmentWritable(db, params.id);
    const updated = await db.enrollment.update({
      where: { id: params.id },
      data,
      include: { assignedLevel: true, sessionGroup: true, examGroup: true },
    });

    if (Object.keys(data).length > 0) {
      await logAudit(db, {
        actorId: actor.id,
        action: 'ENROLLMENT_UPDATED',
        entityType: 'Enrollment',
        entityId: params.id,
        newValue: data,
      });
    }

    return updated;
  },
);

export const DELETE = route<{ id: string }>(
  { resource: 'Enrollment', access: 'write' },
  async ({ db, params, actor }) => {
    await removeEnrollment(db, params.id, actor.id);
    return undefined; // 204
  },
);
