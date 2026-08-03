/**
 * Organisation des groupes.
 *
 * Gabarits et groupes réels vivent dans la même table `StudentGroup` :
 *   - `isTemplate = true`  → gabarit réutilisable, sans session
 *   - `isTemplate = false` → groupe réel rattaché à une session
 */
import type { Db } from './db';
import { withTransaction } from './db';
import { notFoundError, validationError } from './errors';
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
  actorId?: string,
  actorRole?: 'MANAGER' | 'USER' | 'ADMIN',
): Promise<OrganizeGroupsResult> {
  await assertSessionWritable(
    db,
    trainingSessionId,
    actorId && actorRole ? { id: actorId, role: actorRole } : null,
  );

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

// ===========================================================================
// Groupes de session PAR NIVEAU
//
// Une session est multi-niveaux : « Anglais 2026-2027 » accueille des A1, des
// B1… Après le test de positionnement, chaque inscrit porte un niveau attribué,
// et l'on constitue autant de groupes que l'effectif l'exige — Groupe 1 à 5 pour
// un même niveau si les salles plafonnent à 25 places.
// ===========================================================================

export interface OrganizeByLevelOptions {
  /**
   * Places par groupe. À défaut, la capacité du premier gabarit de session ;
   * sans gabarit chiffré, l'appel échoue plutôt que de deviner.
   */
  capacity?: number;
}

export interface OrganizeByLevelResult {
  removed: number;
  created: number;
  /** Détail par niveau : effectif constaté et nombre de groupes ouverts. */
  byLevel: Array<{
    levelId: string;
    levelName: string;
    enrollments: number;
    groups: number;
  }>;
  /** Inscrits sans niveau attribué : aucun groupe ne peut les accueillir. */
  withoutLevel: number;
  capacity: number;
}

/** Noms de gabarits disponibles, complétés au-delà par « Groupe n ». */
function groupNameAt(templateNames: readonly string[], index: number): string {
  return templateNames[index] ?? `Groupe ${index + 1}`;
}

/**
 * Ouvre les groupes de session, niveau par niveau, dimensionnés sur l'effectif.
 *
 * À lancer APRÈS le test de positionnement : la répartition s'appuie sur
 * `Enrollment.assignedLevel`. Les groupes existants du type SESSION sont
 * remplacés ; les inscriptions, elles, sont conservées (`onDelete: SetNull`).
 */
export async function organizeGroupsByLevel(
  db: Db,
  trainingSessionId: string,
  options: OrganizeByLevelOptions = {},
  actorId?: string,
  actorRole?: 'MANAGER' | 'USER' | 'ADMIN',
): Promise<OrganizeByLevelResult> {
  await assertSessionWritable(
    db,
    trainingSessionId,
    actorId && actorRole ? { id: actorId, role: actorRole } : null,
  );

  const templates = await db.studentGroup.findMany({
    where: { isTemplate: true, groupType: 'SESSION', disabled: false },
    orderBy: { sequence: 'asc' },
  });

  const capacity = options.capacity ?? templates.find((t) => t.capacity !== null)?.capacity ?? null;
  if (capacity === null || capacity <= 0) {
    throw validationError(
      'Capacité des groupes inconnue : précisez-la ou renseignez-la sur un gabarit de session.',
      { trainingSessionId },
    );
  }

  const enrollments = await db.enrollment.findMany({
    where: { trainingSessionId },
    select: {
      assignedLevelId: true,
      assignedLevel: { select: { id: true, name: true, sequence: true } },
    },
  });

  // Effectif par niveau, ordonné par progression CECRL.
  const perLevel = new Map<string, { name: string; sequence: number; count: number }>();
  let withoutLevel = 0;

  for (const enrollment of enrollments) {
    const level = enrollment.assignedLevel;
    if (!level) {
      withoutLevel += 1;
      continue;
    }
    const bucket = perLevel.get(level.id);
    if (bucket) bucket.count += 1;
    else perLevel.set(level.id, { name: level.name, sequence: level.sequence, count: 1 });
  }

  const levels = [...perLevel.entries()].sort((a, b) => a[1].sequence - b[1].sequence);
  const templateNames = templates.map((t) => t.name);
  const firstTemplate = templates[0];

  return withTransaction(db, async (tx) => {
    const { count: removed } = await tx.studentGroup.deleteMany({
      where: { trainingSessionId, groupType: 'SESSION', isTemplate: false },
    });

    const byLevel: OrganizeByLevelResult['byLevel'] = [];
    let created = 0;

    for (const [levelId, level] of levels) {
      const groupCount = Math.max(1, Math.ceil(level.count / capacity));

      for (let index = 0; index < groupCount; index += 1) {
        await tx.studentGroup.create({
          data: {
            name: groupNameAt(templateNames, index),
            groupType: 'SESSION',
            isTemplate: false,
            sequence: index + 1,
            capacity,
            trainingSessionId,
             trainingLevelId: levelId,
             // Les caractéristiques logistiques viennent du 1er gabarit ; elles
             // restent ajustables groupe par groupe ensuite. Le même enseignant
             // peut ainsi être partagé par plusieurs groupes.
             teacherId: firstTemplate?.teacherId ?? null,
             site: firstTemplate?.site ?? null,
            startTime: firstTemplate?.startTime ?? null,
            endTime: firstTemplate?.endTime ?? null,
            hourlyVolume: firstTemplate?.hourlyVolume ?? null,
          },
        });
        created += 1;
      }

      byLevel.push({
        levelId,
        levelName: level.name,
        enrollments: level.count,
        groups: groupCount,
      });
    }

    return { removed, created, byLevel, withoutLevel, capacity };
  });
}

export interface AssignByLevelResult {
  assigned: number;
  /** Inscrits dont le niveau n'a plus de place disponible. */
  unassigned: number;
  /** Inscrits sans niveau attribué : le test de positionnement reste à faire. */
  withoutLevel: number;
  occupancy: Array<{
    groupId: string;
    name: string;
    levelName: string | null;
    capacity: number | null;
    count: number;
  }>;
}

/**
 * Range chaque inscrit dans un groupe de SON niveau.
 *
 * Ne touche pas aux inscriptions déjà affectées et compte leurs places dans la
 * capacité : relancer après l'arrivée de nouveaux inscrits complète les groupes
 * au lieu de tout rebrasser.
 */
export async function assignGroupsByLevel(
  db: Db,
  trainingSessionId: string,
  actorId?: string,
  actorRole?: 'MANAGER' | 'USER' | 'ADMIN',
): Promise<AssignByLevelResult> {
  await assertSessionWritable(
    db,
    trainingSessionId,
    actorId && actorRole ? { id: actorId, role: actorRole } : null,
  );

  const groups = await db.studentGroup.findMany({
    where: {
      trainingSessionId,
      groupType: 'SESSION',
      isTemplate: false,
      disabled: false,
      trainingLevelId: { not: null },
    },
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      name: true,
      capacity: true,
      trainingLevelId: true,
      trainingLevel: { select: { name: true, sequence: true } },
    },
  });

  if (groups.length === 0) {
    throw notFoundError(
      'Aucun groupe de session par niveau : ouvrez-les d’abord depuis les gabarits.',
      { trainingSessionId },
    );
  }

  const counts = await db.enrollment.groupBy({
    by: ['sessionGroupId'],
    where: { trainingSessionId, sessionGroupId: { not: null } },
    _count: { _all: true },
  });
  const occupancy = new Map<string, number>(
    counts.flatMap((row) => (row.sessionGroupId ? [[row.sessionGroupId, row._count._all]] : [])),
  );

  /** Groupes disponibles pour un niveau donné, dans l'ordre d'ouverture. */
  const groupsByLevel = new Map<string, typeof groups>();
  for (const group of groups) {
    if (!group.trainingLevelId) continue;
    const bucket = groupsByLevel.get(group.trainingLevelId);
    if (bucket) bucket.push(group);
    else groupsByLevel.set(group.trainingLevelId, [group]);
  }

  const pending = await db.enrollment.findMany({
    where: { trainingSessionId, sessionGroupId: null },
    orderBy: [{ participant: { familyName: 'asc' } }, { participant: { firstName: 'asc' } }],
    select: { id: true, assignedLevelId: true },
  });

  const assignments: Array<{ enrollmentId: string; groupId: string }> = [];
  let withoutLevel = 0;
  let unassigned = 0;

  for (const enrollment of pending) {
    if (!enrollment.assignedLevelId) {
      withoutLevel += 1;
      continue;
    }

    const candidates = groupsByLevel.get(enrollment.assignedLevelId) ?? [];
    const target = candidates.find((group) => {
      const used = occupancy.get(group.id) ?? 0;
      return group.capacity === null || used < group.capacity;
    });

    if (!target) {
      unassigned += 1;
      continue;
    }

    assignments.push({ enrollmentId: enrollment.id, groupId: target.id });
    occupancy.set(target.id, (occupancy.get(target.id) ?? 0) + 1);
  }

  if (assignments.length > 0) {
    await withTransaction(db, async (tx) => {
      for (const assignment of assignments) {
        await tx.enrollment.update({
          where: { id: assignment.enrollmentId },
          data: { sessionGroupId: assignment.groupId },
        });
      }
    });
  }

  return {
    assigned: assignments.length,
    unassigned,
    withoutLevel,
    occupancy: groups.map((group) => ({
      groupId: group.id,
      name: group.name,
      levelName: group.trainingLevel?.name ?? null,
      capacity: group.capacity,
      count: occupancy.get(group.id) ?? 0,
    })),
  };
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
  actorId?: string,
  actorRole?: 'MANAGER' | 'USER' | 'ADMIN',
): Promise<AssignExamGroupsResult> {
  await assertSessionWritable(
    db,
    trainingSessionId,
    actorId && actorRole ? { id: actorId, role: actorRole } : null,
  );

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
    orderBy: [{ groupType: 'asc' }, { trainingLevel: { sequence: 'asc' } }, { sequence: 'asc' }],
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
      trainingLevel: { select: { id: true, name: true, sequence: true } },
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
