export interface WorkspaceSession {
  id: string;
  /** Titre DÉRIVÉ, calculé côté serveur par `deriveSessionTitle`. */
  title: string;
  trainingName: string;
  levelName: string | null;
  academicYear: string | null;
  years: { yearFrom: number | null; yearTo: number | null };
  state: 'OPEN' | 'LOCKED';
  mode: 'PRESENTIAL' | 'REMOTE' | 'HYBRID' | null;
  status: 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | null;
  admissionThreshold: number;
  matriculePrefix: string | null;
}

export interface WorkspacePermissions {
  enrollment: boolean;
  scores: boolean;
  groups: boolean;
  session: boolean;
}

export interface ParticipantSummary {
  id: string;
  familyName: string | null;
  firstName: string | null;
  arabName: string | null;
  arabFirstName: string | null;
  registrationNumber: string;
  phone?: string | null;
  type?: 'STUDENT' | 'TEACHER';
}

export interface NamedRef {
  id: string;
  name: string;
}

export interface EnrollmentRow {
  id: string;
  kind: 'NEW' | 'RETURNING';
  registrationNumber: string | null;
  responsible: string | null;
  participant: ParticipantSummary;
  assignedLevel: NamedRef | null;
  sessionGroup: NamedRef | null;
  examGroup: NamedRef | null;
  /** Nom complet DÉRIVÉ côté serveur. */
  fullName: string;
}

export interface EnrollmentsPayload {
  session: {
    id: string;
    state: 'OPEN' | 'LOCKED';
    title: string;
    admissionThreshold: number;
    matriculePrefix: string | null;
    /** Niveaux du catalogue de la formation — filtrés côté serveur. */
    levels: NamedRef[];
  };
  rows: EnrollmentRow[];
}

export interface DeliberationRow {
  enrollmentId: string;
  entryId: string | null;
  enrollmentNumber: string | null;
  participant: ParticipantSummary;
  assignedLevel: NamedRef | null;
  sessionGroup: NamedRef | null;
  oralExpression: number | null;
  writtenExpression: number | null;
  oralComprehension: number | null;
  writtenComprehension: number | null;
  total: number | null;
  status: 'ADMITTED' | 'REFUSED' | null;
}

export interface DeliberationPayload {
  trainingSessionId: string;
  state: 'OPEN' | 'LOCKED';
  admissionThreshold: number;
  rows: DeliberationRow[];
}

export interface PositioningRow {
  enrollmentId: string;
  enrollmentNumber: string | null;
  participant: ParticipantSummary;
  writtenExpression: number | null;
  writtenComprehension: number | null;
  total: number | null;
  resolvedLevel: NamedRef | null;
  assignedLevel: NamedRef | null;
}

export interface PositioningPayload {
  test?: { id: string; title: string | null; state: 'OPEN' | 'LOCKED' };
  readOnly?: boolean;
  levels?: NamedRef[];
  rows: PositioningRow[];
  tests?: Array<{ id: string; title: string | null; date: string | null; state: string }>;
}

export interface GroupRow {
  id: string;
  name: string;
  groupType: 'SESSION' | 'EXAM';
  sequence: number;
  site: string | null;
  capacity: number | null;
  startTime: string | null;
  endTime: string | null;
  hourlyVolume: number | null;
  disabled: boolean;
  teacher: NamedRef | null;
  trainingLevel: (NamedRef & { sequence: number }) | null;
  count: number;
}

export interface AdmissionSummary {
  admitted: number;
  refused: number;
  pending: number;
  total: number;
  admissionThreshold: number;
}
