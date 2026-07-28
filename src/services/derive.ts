/**
 * VALEURS DÉRIVÉES — source unique de vérité.
 *
 * Aucune des valeurs calculées ici n'est stockée en base. Ce module est importé
 * à la fois par l'API et par l'UI (grilles éditables) : les colonnes calculées
 * affichées à l'écran et les valeurs utilisées côté serveur proviennent donc
 * exactement du même code, sans risque de divergence.
 *
 * Contrainte : ce fichier reste PUR — aucune dépendance à Prisma, au réseau ou
 * au DOM, pour rester exécutable dans un composant client comme dans un test.
 * Les types d'entrée sont structurels afin d'accepter aussi bien un modèle
 * Prisma qu'un DTO sérialisé.
 */

// ============================================================================
// Types structurels
// ============================================================================

export type Nullable<T> = T | null | undefined;

export type ParticipantTypeLike = 'STUDENT' | 'TEACHER';
export type WorkflowStateLike = 'OPEN' | 'LOCKED';

/** Statut d'admission. `null` = non délibéré (aucune note saisie). */
export type AdmissionStatus = 'ADMITTED' | 'REFUSED';

export interface ParticipantNameInput {
  familyName?: Nullable<string>;
  firstName?: Nullable<string>;
}

export interface ParticipantArabicNameInput {
  arabName?: Nullable<string>;
  arabFirstName?: Nullable<string>;
}

export interface TrainingNameInput {
  frName: string;
  arName?: Nullable<string>;
}

export interface LevelIntervalInput {
  id: string;
  name: string;
  sequence: number;
  minimumPoints: number;
  maximumPoints: number;
  disabled?: Nullable<boolean>;
}

export interface SessionTitleInput {
  training?: Nullable<TrainingNameInput>;
  trainingLevel?: Nullable<{ name: string }>;
  academicYear?: Nullable<string>;
}

export interface DateRangeInput {
  dateFrom?: Nullable<Date | string>;
  dateTo?: Nullable<Date | string>;
}

export interface PositioningScoreInput {
  /** E.E — expression écrite. */
  writtenExpression?: Nullable<number>;
  /** C.E — compréhension écrite. */
  writtenComprehension?: Nullable<number>;
}

export interface DeliberationEntryInput {
  /** E.O */
  oralExpression?: Nullable<number>;
  /** E.E */
  writtenExpression?: Nullable<number>;
  /** C.O */
  oralComprehension?: Nullable<number>;
  /** C.E */
  writtenComprehension?: Nullable<number>;
}

// ============================================================================
// Utilitaires internes
// ============================================================================

function clean(value: Nullable<string>): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isNumber(value: Nullable<number>): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Somme des valeurs renseignées. Retourne `null` si AUCUNE n'est renseignée :
 * une ligne vierge se distingue ainsi d'un total réellement nul.
 */
export function sumScores(values: ReadonlyArray<Nullable<number>>): number | null {
  const present = values.filter(isNumber);
  if (present.length === 0) return null;
  return present.reduce((acc, value) => acc + value, 0);
}

function toDate(value: Nullable<Date | string>): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ============================================================================
// Noms et titres
// ============================================================================

/** `fullName` du participant — DÉRIVÉ, jamais stocké. */
export function deriveParticipantFullName(participant: ParticipantNameInput): string {
  return [clean(participant.familyName), clean(participant.firstName)]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** Nom complet arabe du participant, pour les documents en RTL. */
export function deriveParticipantArabicFullName(participant: ParticipantArabicNameInput): string {
  return [clean(participant.arabName), clean(participant.arabFirstName)]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** `fullName` de la formation : `"{frName} ({arName})"` — DÉRIVÉ. */
export function deriveTrainingFullName(training: TrainingNameInput): string {
  const fr = clean(training.frName);
  const ar = clean(training.arName);
  return ar ? `${fr} (${ar})` : fr;
}

/** `title` de la session : `"{formation} {niveau} {année}"` — DÉRIVÉ. */
export function deriveSessionTitle(session: SessionTitleInput): string {
  return [
    session.training ? clean(session.training.frName) : '',
    session.trainingLevel ? clean(session.trainingLevel.name) : '',
    clean(session.academicYear),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

// ============================================================================
// Dates : années et mois arabe
// ============================================================================

/**
 * Mois en arabe, convention algérienne (dérivée du français), utilisée par les
 * documents officiels du CEIL. Index 1..12.
 */
export const ARABIC_MONTHS: Readonly<Record<number, string>> = Object.freeze({
  1: 'جانفي',
  2: 'فيفري',
  3: 'مارس',
  4: 'أفريل',
  5: 'ماي',
  6: 'جوان',
  7: 'جويلية',
  8: 'أوت',
  9: 'سبتمبر',
  10: 'أكتوبر',
  11: 'نوفمبر',
  12: 'ديسمبر',
});

/** Mois arabe à partir du numéro 1..12. Retourne `null` hors intervalle. */
export function arabicMonth(month: Nullable<number>): string | null {
  if (!isNumber(month)) return null;
  return ARABIC_MONTHS[month] ?? null;
}

/** Mois arabe d'une date (utilisé pour le mois de fin de session du diplôme). */
export function arabicMonthOfDate(value: Nullable<Date | string>): string | null {
  const date = toDate(value);
  return date ? arabicMonth(date.getMonth() + 1) : null;
}

/** `yearFrom` / `yearTo` — DÉRIVÉS des dates de la session. */
export function deriveYears(range: DateRangeInput): {
  yearFrom: number | null;
  yearTo: number | null;
} {
  return {
    yearFrom: toDate(range.dateFrom)?.getFullYear() ?? null,
    yearTo: toDate(range.dateTo)?.getFullYear() ?? null,
  };
}

/** `arabicMonthTo` — mois de fin de session en arabe, pour le diplôme. */
export function deriveArabicMonthTo(range: DateRangeInput): string | null {
  return arabicMonthOfDate(range.dateTo);
}

// ============================================================================
// Positionnement : total et niveau résolu
// ============================================================================

/** Total du test de positionnement : E.E + C.E — DÉRIVÉ. */
export function derivePositioningTotal(score: PositioningScoreInput): number | null {
  return sumScores([score.writtenExpression, score.writtenComprehension]);
}

/**
 * Niveau dont l'intervalle SEMI-OUVERT `[minimumPoints, maximumPoints[`
 * contient `points`. Les niveaux désactivés sont ignorés ; en cas de
 * chevauchement, le `sequence` le plus faible l'emporte (résultat déterministe).
 */
export function resolveLevelForPoints<T extends LevelIntervalInput>(
  levels: readonly T[],
  points: Nullable<number>,
): T | null {
  if (!isNumber(points)) return null;

  const candidates = levels
    .filter((level) => !level.disabled)
    .filter((level) => points >= level.minimumPoints && points < level.maximumPoints)
    .sort((a, b) => a.sequence - b.sequence);

  return candidates[0] ?? null;
}

/** Total et niveau résolu d'une ligne de positionnement, en une passe. */
export function derivePositioning<T extends LevelIntervalInput>(
  score: PositioningScoreInput,
  levels: readonly T[],
): { total: number | null; resolvedLevel: T | null } {
  const total = derivePositioningTotal(score);
  return { total, resolvedLevel: resolveLevelForPoints(levels, total) };
}

// ============================================================================
// Délibération : total et statut d'admission
// ============================================================================

/** Total de la délibération : somme des 4 compétences — DÉRIVÉ. */
export function deriveEntryTotal(entry: DeliberationEntryInput): number | null {
  return sumScores([
    entry.oralExpression,
    entry.writtenExpression,
    entry.oralComprehension,
    entry.writtenComprehension,
  ]);
}

/**
 * Statut d'admission — DÉRIVÉ : ADMITTED si `total >= seuil`, sinon REFUSED.
 * Retourne `null` quand aucune note n'est saisie : une ligne vierge n'est pas
 * « ajournée », elle n'est pas encore délibérée.
 */
export function deriveAdmissionStatus(
  total: Nullable<number>,
  admissionThreshold: number,
): AdmissionStatus | null {
  if (!isNumber(total)) return null;
  return total >= admissionThreshold ? 'ADMITTED' : 'REFUSED';
}

/** Total et statut d'une ligne de délibération, en une passe. */
export function deriveEntryTotalAndStatus(
  entry: DeliberationEntryInput,
  admissionThreshold: number,
): { total: number | null; status: AdmissionStatus | null } {
  const total = deriveEntryTotal(entry);
  return { total, status: deriveAdmissionStatus(total, admissionThreshold) };
}

// ============================================================================
// Verrouillage
// ============================================================================

/** Une session ou un test verrouillé interdit toute écriture sur ses lignes. */
export function isLocked(state: Nullable<WorkflowStateLike>): boolean {
  return state === 'LOCKED';
}

// ============================================================================
// Formats de matricules
//
// Le FORMAT est dérivé (pur) ; l'ALLOCATION du compteur, elle, est un état
// persistant géré en transaction par `services/registration-numbers.ts`.
// ============================================================================

/** Largeur du compteur dans les matricules (`1` → `0001`). */
export const SEQUENCE_PAD = 4;

function pad(sequence: number): string {
  return String(sequence).padStart(SEQUENCE_PAD, '0');
}

/** Segment identifiant le type de participant dans son matricule. */
export function participantTypeSegment(type: ParticipantTypeLike): 'ETU' | 'ENS' {
  return type === 'TEACHER' ? 'ENS' : 'ETU';
}

/** `PART-ETU-{YYYY}-{n}` ou `PART-ENS-{YYYY}-{n}`. */
export function formatParticipantRegistrationNumber(
  type: ParticipantTypeLike,
  year: number,
  sequence: number,
): string {
  return `PART-${participantTypeSegment(type)}-${year}-${pad(sequence)}`;
}

/** Matricule d'inscription, construit sur le `matriculePrefix` de la session. */
export function formatEnrollmentRegistrationNumber(
  matriculePrefix: Nullable<string>,
  sequence: number,
): string {
  const prefix = clean(matriculePrefix) || 'INS';
  return `${prefix}-${pad(sequence)}`;
}

/** `PAY-{YYYY}-{n}`. */
export function formatReceiptNumber(year: number, sequence: number): string {
  return `PAY-${year}-${pad(sequence)}`;
}

// ============================================================================
// Affichage
// ============================================================================

/**
 * Date de naissance à afficher : la mention approximative prend le pas sur la
 * date exacte lorsque `birthDateIsApproximate` est vrai.
 */
export function deriveBirthDisplay(participant: {
  birthDate?: Nullable<Date | string>;
  birthDateIsApproximate?: Nullable<boolean>;
  approximateBirth?: Nullable<string>;
}): string | null {
  if (participant.birthDateIsApproximate) {
    return clean(participant.approximateBirth) || null;
  }
  const date = toDate(participant.birthDate);
  if (!date) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}
