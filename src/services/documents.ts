/**
 * Données des documents officiels.
 *
 * Rien n'est recalculé ici : noms composés, titre de session, totaux, statuts,
 * années et mois arabe viennent tous de `derive.ts`. Un diplôme ne doit pas
 * pouvoir afficher un total différent de celui de la grille de délibération.
 */
import type { Db } from './db';
import { getDeliberation } from './deliberation';
import {
  deriveArabicMonthTo,
  deriveFrenchMonthTo,
  deriveBirthDisplay,
  deriveParticipantArabicFullName,
  deriveParticipantFullName,
  deriveSessionTitle,
  deriveTrainingFullName,
  deriveYears,
  type AdmissionStatus,
} from './derive';
import { notFoundError, unprocessableError } from './errors';

export interface DocumentHeader {
  /** Gabarit retenu : celui de la session, à défaut le modèle par défaut. */
  model: {
    name: string;
    heading: string | null;
    universityLogo: string | null;
    associationLogo: string | null;
    backgroundImage: string | null;
  } | null;
  sessionId: string;
  sessionTitle: string;
  trainingFr: string;
  trainingAr: string | null;
  trainingFullName: string;
  levelName: string | null;
  academicYear: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  /** Mois de fin de session en arabe — exigé sur le diplôme. */
  arabicMonthTo: string | null;
  /** Mois de fin de session en français — utilisé sur le procès-verbal. */
  frenchMonthTo: string | null;
  admissionThreshold: number;
}

export interface DocumentPerson {
  enrollmentId: string;
  registrationNumber: string;
  participantNumber: string;
  fullName: string;
  arabicFullName: string;
  birth: string | null;
  birthDate: Date | null;
  birthPlace: string | null;
  arabicBirthPlace: string | null;
  levelName: string | null;
  levelId: string | null;
  groupName: string | null;
  teacherName: string | null;
  gender: 'WOMAN' | 'MAN' | null;
  scores: {
    oralExpression: number | null;
    writtenExpression: number | null;
    oralComprehension: number | null;
    writtenComprehension: number | null;
  };
  total: number | null;
  status: AdmissionStatus | null;
}

async function loadHeader(db: Db, trainingSessionId: string): Promise<DocumentHeader> {
  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: {
      id: true,
      academicYear: true,
      dateFrom: true,
      dateTo: true,
      admissionThreshold: true,
      training: { select: { frName: true, arName: true } },
      trainingLevel: { select: { name: true } },
      diplomaModel: {
        select: {
          name: true,
          heading: true,
          universityLogo: true,
          associationLogo: true,
          backgroundImage: true,
          disabled: true,
        },
      },
    },
  });

  if (!session) {
    throw notFoundError('Session de formation introuvable.', { trainingSessionId });
  }

  // Un gabarit désactivé ne doit pas servir : on retombe sur le modèle par défaut.
  const fallback =
    !session.diplomaModel || session.diplomaModel.disabled
      ? await db.diplomaModel.findFirst({
          where: { isDefault: true, disabled: false },
          select: {
            name: true,
            heading: true,
            universityLogo: true,
            associationLogo: true,
            backgroundImage: true,
          },
        })
      : null;

  const model =
    session.diplomaModel && !session.diplomaModel.disabled
      ? {
          name: session.diplomaModel.name,
          heading: session.diplomaModel.heading,
          universityLogo: session.diplomaModel.universityLogo,
          associationLogo: session.diplomaModel.associationLogo,
          backgroundImage: session.diplomaModel.backgroundImage,
        }
      : fallback;

  const years = deriveYears(session);

  return {
    model,
    sessionId: session.id,
    sessionTitle: deriveSessionTitle(session),
    trainingFr: session.training.frName,
    trainingAr: session.training.arName,
    trainingFullName: deriveTrainingFullName(session.training),
    levelName: session.trainingLevel?.name ?? null,
    academicYear: session.academicYear,
    yearFrom: years.yearFrom,
    yearTo: years.yearTo,
    arabicMonthTo: deriveArabicMonthTo(session),
    frenchMonthTo: deriveFrenchMonthTo(session),
    admissionThreshold: session.admissionThreshold,
  };
}

/** Personnes de la session, avec totaux et statuts dérivés. */
async function loadPeople(db: Db, trainingSessionId: string): Promise<DocumentPerson[]> {
  const deliberation = await getDeliberation(db, trainingSessionId);

  const births = await db.enrollment.findMany({
    where: { trainingSessionId },
    select: {
      id: true,
      participant: {
        select: {
          birthDate: true,
          birthDateIsApproximate: true,
          approximateBirth: true,
          birthPlace: true,
          arabBirthPlace: true,
          gender: true,
        },
      },
    },
  });
  const birthByEnrollment = new Map(births.map((row) => [row.id, row.participant]));

  const seen = new Set<string>();
  const uniqueRows = deliberation.rows.filter((row) => {
    if (seen.has(row.enrollmentId)) return false;
    seen.add(row.enrollmentId);
    return true;
  });

  return uniqueRows.map((row) => {
    const participant = birthByEnrollment.get(row.enrollmentId);

    return {
      enrollmentId: row.enrollmentId,
      registrationNumber: row.enrollmentNumber ?? row.participant.registrationNumber,
      participantNumber: row.participant.registrationNumber,
      fullName: deriveParticipantFullName(row.participant),
      arabicFullName: deriveParticipantArabicFullName(row.participant),
      birth: participant ? deriveBirthDisplay(participant) : null,
      birthDate: participant?.birthDate ?? null,
      birthPlace: participant?.birthPlace ?? null,
      arabicBirthPlace: participant?.arabBirthPlace ?? null,
      levelName: row.assignedLevel?.name ?? null,
      levelId: row.assignedLevel?.id ?? null,
      groupName: row.sessionGroup?.name ?? null,
      teacherName: row.sessionGroup?.teacher?.name ?? null,
      gender: participant?.gender ?? null,
      scores: {
        oralExpression: row.oralExpression,
        writtenExpression: row.writtenExpression,
        oralComprehension: row.oralComprehension,
        writtenComprehension: row.writtenComprehension,
      },
      total: row.total,
      status: row.status,
    };
  });
}

export interface SessionDocument {
  header: DocumentHeader;
  people: DocumentPerson[];
}

/** Procès-verbal : toutes les inscriptions, notées ou non — ou un niveau filtré. */
export async function getMinutesDocument(
  db: Db,
  trainingSessionId: string,
  levelId?: string | null,
): Promise<SessionDocument> {
  const [header, people] = await Promise.all([
    loadHeader(db, trainingSessionId),
    loadPeople(db, trainingSessionId),
  ]);

  const filtered = levelId ? people.filter((person) => person.levelId === levelId) : people;

  filtered.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { numeric: true }));

  return { header, people: filtered };
}

/**
 * Diplômes : uniquement les ADMIS.
 *
 * Un diplôme délivré à un ajourné serait une faute grave ; le filtre est donc
 * appliqué ici, et non laissé à l'appelant.
 */
export async function getDiplomaDocument(
  db: Db,
  trainingSessionId: string,
  enrollmentId?: string,
): Promise<SessionDocument> {
  const { header, people } = await getMinutesDocument(db, trainingSessionId);
  const admitted = people.filter((person) => person.status === 'ADMITTED');

  if (!enrollmentId) return { header, people: admitted };

  const one = admitted.find((person) => person.enrollmentId === enrollmentId);
  if (!one) {
    // Distinguer « inconnu » de « non admis » : le second est un refus métier.
    const exists = people.some((person) => person.enrollmentId === enrollmentId);
    if (exists) {
      throw unprocessableError(
        'Aucun diplôme pour cette inscription : le participant n’est pas admis.',
        { enrollmentId },
      );
    }
    throw notFoundError('Inscription introuvable dans cette session.', { enrollmentId });
  }

  return { header, people: [one] };
}

/** Attestations : toute inscription y ouvre droit, admise ou non. */
export async function getAttestationDocument(
  db: Db,
  trainingSessionId: string,
  enrollmentId?: string,
): Promise<SessionDocument> {
  const { header, people } = await getMinutesDocument(db, trainingSessionId);
  if (!enrollmentId) return { header, people };

  const one = people.find((person) => person.enrollmentId === enrollmentId);
  if (!one) {
    throw notFoundError('Inscription introuvable dans cette session.', { enrollmentId });
  }
  return { header, people: [one] };
}

export interface GroupListDocument extends SessionDocument {
  group: { id: string; name: string; levelName: string | null; capacity: number | null } | null;
}

/** Liste d'émargement d'un groupe, ou de toute la session si aucun groupe. */
export async function getGroupListDocument(
  db: Db,
  trainingSessionId: string,
  groupId?: string,
): Promise<GroupListDocument> {
  const { header, people } = await getMinutesDocument(db, trainingSessionId);

  if (!groupId) return { header, people, group: null };

  const group = await db.studentGroup.findFirst({
    where: { id: groupId, trainingSessionId },
    select: {
      id: true,
      name: true,
      capacity: true,
      groupType: true,
      trainingLevel: { select: { name: true } },
    },
  });
  if (!group) {
    throw notFoundError('Groupe introuvable dans cette session.', { groupId });
  }

  const memberIds = await db.enrollment.findMany({
    where:
      group.groupType === 'SESSION'
        ? { trainingSessionId, sessionGroupId: groupId }
        : { trainingSessionId, examGroupId: groupId },
    select: { id: true },
  });
  const members = new Set(memberIds.map((row) => row.id));

  return {
    header,
    people: people.filter((person) => members.has(person.enrollmentId)),
    group: {
      id: group.id,
      name: group.name,
      levelName: group.trainingLevel?.name ?? null,
      capacity: group.capacity,
    },
  };
}
