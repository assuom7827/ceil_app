/**
 * Organisation des groupes.
 *
 * Gabarits et groupes réels vivent dans la même table `StudentGroup` :
 *   - `isTemplate = true`  → gabarit réutilisable, sans session
 *   - `isTemplate = false` → groupe réel rattaché à une session
 */
import type { Db } from './db';
import { withTransaction } from './db';
import { notFoundError } from './errors';
import { assertSessionWritable } from './locking';

export type GroupTypeLike = 'SESSION' | 'EXAM';

export interface OrganizeGroupsResult {
  /** Groupes réels supprimés avant réorganisation. */
  removed: number;
  /** Groupes réels instanciés depuis les gabarits. */
  created: number;
}

/**
 * Réinstancie les groupes réels d'un type à partir des gabarits actifs.
 *
 * Les anciens groupes sont supprimés : les inscriptions qui y étaient affectées
 * voient leur référence remise à `null` (`onDelete: SetNull`), pas supprimées.
 */
export async function organizeGroups(
  db: Db,
  trainingSessionId: string,
  groupType: GroupTypeLike,
): Promise<OrganizeGroupsResult> {
  await assertSessionWritable(db, trainingSessionId);

  const templates = await db.studentGroup.findMany({
    where: { isTemplate: true, groupType, disabled: false },
    orderBy: { sequence: 'asc' },
  });

  return withTransaction(db, async (tx) => {
    const { count: removed } = await tx.studentGroup.deleteMany({
      where: { trainingSessionId, groupType, isTemplate: false },
    });

    for (const template of templates) {
      await tx.studentGroup.create({
        data: {
          name: template.name,
          groupType: template.groupType,
          isTemplate: false,
          sequence: template.sequence,
          site: template.site,
          teacherId: template.teacherId,
          dateStart: template.dateStart,
          dateEnd: template.dateEnd,
          startTime: template.startTime,
          endTime: template.endTime,
          hourlyVolume: template.hourlyVolume,
          capacity: template.capacity,
          trainingSessionId,
        },
      });
    }

    return { removed, created: templates.length };
  });
}

export interface AssignExamGroupsResult {
  /** Inscriptions affectées par cet appel. */
  assigned: number;
  /** Inscriptions restées sans groupe, faute de place. */
  unassigned: number;
  /** Détail par groupe : places occupées après répartition. */
  occupancy: Array<{ groupId: string; name: string; capacity: number | null; count: number }>;
}

/**
 * Répartit séquentiellement les inscriptions sans groupe d'examen.
 *
 * Les places déjà occupées comptent dans la capacité : relancer la répartition
 * complète les groupes existants au lieu de les vider. Un groupe sans capacité
 * définie est considéré comme illimité.
 */
export async function assignExamGroups(
  db: Db,
  trainingSessionId: string,
): Promise<AssignExamGroupsResult> {
  await assertSessionWritable(db, trainingSessionId);

  const groups = await db.studentGroup.findMany({
    where: { trainingSessionId, groupType: 'EXAM', isTemplate: false, disabled: false },
    orderBy: { sequence: 'asc' },
    select: { id: true, name: true, capacity: true },
  });

  if (groups.length === 0) {
    throw notFoundError(
      'Aucun groupe d’examen dans cette session : organisez-les depuis les gabarits d’abord.',
      { trainingSessionId },
    );
  }

  const counts = await db.enrollment.groupBy({
    by: ['examGroupId'],
    where: { trainingSessionId, examGroupId: { not: null } },
    _count: { _all: true },
  });
  const occupancy = new Map<string, number>(
    counts.flatMap((row) => (row.examGroupId ? [[row.examGroupId, row._count._all]] : [])),
  );

  const pending = await db.enrollment.findMany({
    where: { trainingSessionId, examGroupId: null },
    orderBy: [{ participant: { familyName: 'asc' } }, { participant: { firstName: 'asc' } }],
    select: { id: true },
  });

  const assignments: Array<{ enrollmentId: string; groupId: string }> = [];
  let cursor = 0;

  for (const enrollment of pending) {
    // Avance jusqu'au premier groupe disposant encore d'une place.
    while (cursor < groups.length) {
      const group = groups[cursor];
      if (!group) break;
      const used = occupancy.get(group.id) ?? 0;
      if (group.capacity === null || used < group.capacity) break;
      cursor += 1;
    }

    const group = groups[cursor];
    if (!group) break; // tous les groupes sont pleins

    assignments.push({ enrollmentId: enrollment.id, groupId: group.id });
    occupancy.set(group.id, (occupancy.get(group.id) ?? 0) + 1);
  }

  if (assignments.length > 0) {
    await withTransaction(db, async (tx) => {
      for (const assignment of assignments) {
        await tx.enrollment.update({
          where: { id: assignment.enrollmentId },
          data: { examGroupId: assignment.groupId },
        });
      }
    });
  }

  return {
    assigned: assignments.length,
    unassigned: pending.length - assignments.length,
    occupancy: groups.map((group) => ({
      groupId: group.id,
      name: group.name,
      capacity: group.capacity,
      count: occupancy.get(group.id) ?? 0,
    })),
  };
}

/** Groupes réels d'une session, avec leur effectif — alimente l'onglet Groupes. */
export async function getSessionGroups(db: Db, trainingSessionId: string) {
  const groups = await db.studentGroup.findMany({
    where: { trainingSessionId, isTemplate: false },
    orderBy: [{ groupType: 'asc' }, { sequence: 'asc' }],
    select: {
      id: true,
      name: true,
      groupType: true,
      sequence: true,
      site: true,
      capacity: true,
      startTime: true,
      endTime: true,
      hourlyVolume: true,
      disabled: true,
      teacher: { select: { id: true, name: true } },
      _count: { select: { sessionEnrollments: true, examEnrollments: true } },
    },
  });

  return groups.map((group) => ({
    ...group,
    count:
      group.groupType === 'SESSION'
        ? group._count.sessionEnrollments
        : group._count.examEnrollments,
  }));
}
