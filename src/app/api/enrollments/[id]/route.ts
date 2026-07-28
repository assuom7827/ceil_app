import { readJson, route } from '@/lib/api/handler';
import { enrollmentUpdateSchema } from '@/lib/validation/schemas';
import { removeEnrollment } from '@/services/enrollment';
import { assertEnrollmentWritable } from '@/services/locking';

/** Édition d'une cellule de la grille des inscrits (niveau, groupe, type). */
export const PATCH = route<{ id: string }>(
  { resource: 'Enrollment', access: 'write' },
  async ({ db, params, request }) => {
    const data = await readJson(request, enrollmentUpdateSchema);
    await assertEnrollmentWritable(db, params.id);
    return db.enrollment.update({
      where: { id: params.id },
      data,
      include: { assignedLevel: true, sessionGroup: true, examGroup: true },
    });
  },
);

export const DELETE = route<{ id: string }>(
  { resource: 'Enrollment', access: 'write' },
  async ({ db, params }) => {
    await removeEnrollment(db, params.id);
    return undefined; // 204
  },
);
