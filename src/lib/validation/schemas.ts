/**
 * Schémas Zod PARTAGÉS client / serveur.
 *
 * L'API les utilise pour valider les requêtes, les formulaires et les grilles
 * éditables pour valider la saisie : une seule définition, donc des règles
 * identiques des deux côtés.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const idSchema = z.string().min(1, 'Identifiant requis');

/** Texte optionnel : la chaîne vide d'un formulaire devient `null`. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional()
  .refine(
    (value) => value === null || value === undefined || z.string().email().safeParse(value).success,
    {
      message: 'Adresse e-mail invalide',
    },
  );

/** Note : positive, laissée libre côté barème, `null` pour « non saisie ». */
export const scoreSchema = z.coerce
  .number()
  .min(0, 'Une note ne peut être négative')
  .max(1000, 'Note hors barème')
  .nullable()
  .optional();

const optionalDate = z.coerce.date().nullable().optional();

const optionalBoolean = z.boolean().optional();

/** Heure murale « HH:mm », sans fuseau ni date. */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue au format HH:mm')
  .nullable()
  .optional();

// ---------------------------------------------------------------------------
// Référentiels
// ---------------------------------------------------------------------------

export const facultySchema = z.object({
  name: z.string().trim().min(1, 'Nom requis'),
  description: optionalText,
  disabled: optionalBoolean,
});

export const specialitySchema = z.object({
  name: z.string().trim().min(1, 'Nom requis'),
  arName: optionalText,
  description: optionalText,
  disabled: optionalBoolean,
});

export const teacherSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis'),
  teacherType: z.enum(['VACATAIRE', 'PERMANENT']),
  phone: optionalText,
  email: optionalEmail,
  description: optionalText,
  disabled: optionalBoolean,
});

export const studentCategorySchema = z.object({
  name: z.string().trim().min(1, 'Nom requis'),
  description: optionalText,
  disabled: optionalBoolean,
});

export const trainingLevelSchema = z
  .object({
    name: z.string().trim().min(1, 'Nom requis'),
    sequence: z.coerce.number().int(),
    minimumPoints: z.coerce.number().int(),
    maximumPoints: z.coerce.number().int(),
    description: optionalText,
    disabled: optionalBoolean,
  })
  // Intervalle semi-ouvert [min, max[ : un maximum non strictement supérieur
  // au minimum donnerait un intervalle vide, donc un niveau inatteignable.
  .refine((value) => value.minimumPoints < value.maximumPoints, {
    message: 'Le maximum doit être strictement supérieur au minimum',
    path: ['maximumPoints'],
  });

export const diplomaModelSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis'),
  isDefault: optionalBoolean,
  universityLogo: optionalText,
  associationLogo: optionalText,
  backgroundImage: optionalText,
  heading: optionalText,
  disabled: optionalBoolean,
});

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const trainingSchema = z.object({
  frName: z.string().trim().min(1, 'Nom français requis'),
  arName: optionalText,
  code: optionalText,
  description: optionalText,
  disabled: optionalBoolean,
  /** Niveaux proposés (relation M2N remplacée intégralement). */
  levelIds: z.array(idSchema).optional(),
});

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

export const participantTypeSchema = z.enum(['STUDENT', 'TEACHER']);

export const participantSchema = z
  .object({
    type: participantTypeSchema.default('STUDENT'),
    familyName: optionalText,
    firstName: optionalText,
    arabName: optionalText,
    arabFirstName: optionalText,
    birthDate: optionalDate,
    birthPlace: optionalText,
    arabBirthPlace: optionalText,
    birthDateIsApproximate: optionalBoolean,
    approximateBirth: optionalText,
    gender: z.enum(['WOMAN', 'MAN']).nullable().optional(),
    phone: optionalText,
    email: optionalEmail,
    note: optionalText,
    facultyId: idSchema.nullable().optional(),
    categoryIds: z.array(idSchema).optional(),
  })
  .refine((value) => Boolean(value.familyName ?? value.firstName ?? value.arabName), {
    message: 'Renseignez au moins un nom (latin ou arabe)',
    path: ['familyName'],
  });

/** Mini-formulaire du dialogue d'inscription : le strict nécessaire. */
export const quickParticipantSchema = z
  .object({
    familyName: optionalText,
    firstName: optionalText,
    arabName: optionalText,
    arabFirstName: optionalText,
    type: participantTypeSchema.default('STUDENT'),
    phone: optionalText,
    email: optionalEmail,
  })
  .refine((value) => Boolean(value.familyName ?? value.firstName ?? value.arabName), {
    message: 'Renseignez au moins un nom',
    path: ['familyName'],
  });

// ---------------------------------------------------------------------------
// Session, groupes, inscriptions
// ---------------------------------------------------------------------------

export const trainingSessionSchema = z.object({
  code: optionalText,
  trainingId: idSchema,
  trainingLevelId: idSchema.nullable().optional(),
  academicYear: optionalText,
  dateFrom: optionalDate,
  dateTo: optionalDate,
  diplomaModelId: idSchema.nullable().optional(),
  admissionThreshold: z.coerce.number().min(0).optional(),
  matriculePrefix: optionalText,
  disabled: optionalBoolean,
});

export const groupTypeSchema = z.enum(['SESSION', 'EXAM']);

export const studentGroupSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis'),
  groupType: groupTypeSchema,
  isTemplate: optionalBoolean,
  sequence: z.coerce.number().int().optional(),
  trainingSessionId: idSchema.nullable().optional(),
  trainingLevelId: idSchema.nullable().optional(),
  site: optionalText,
  teacherId: idSchema.nullable().optional(),
  dateStart: optionalDate,
  dateEnd: optionalDate,
  startTime: timeSchema,
  endTime: timeSchema,
  hourlyVolume: z.coerce.number().int().min(0).nullable().optional(),
  capacity: z.coerce.number().int().min(1).nullable().optional(),
  disabled: optionalBoolean,
});

export const enrollmentKindSchema = z.enum(['NEW', 'RETURNING']);

/** Inscription simplifiée : identifiants existants et/ou créations à la volée. */
export const enrollSchema = z
  .object({
    participantIds: z.array(idSchema).default([]),
    newParticipants: z.array(quickParticipantSchema).default([]),
    kind: enrollmentKindSchema.optional(),
    responsible: optionalText,
  })
  .refine((value) => value.participantIds.length + value.newParticipants.length > 0, {
    message: 'Sélectionnez ou créez au moins un participant',
    path: ['participantIds'],
  });

export const enrollmentUpdateSchema = z.object({
  kind: enrollmentKindSchema.optional(),
  assignedLevelId: idSchema.nullable().optional(),
  sessionGroupId: idSchema.nullable().optional(),
  examGroupId: idSchema.nullable().optional(),
  responsible: optionalText,
});

export const assignGroupSchema = z.object({
  enrollmentIds: z.array(idSchema).min(1, 'Sélectionnez au moins une inscription'),
  groupType: groupTypeSchema,
  groupId: idSchema.nullable(),
});

// ---------------------------------------------------------------------------
// Évaluations
// ---------------------------------------------------------------------------

export const positioningTestSchema = z.object({
  title: optionalText,
  trainingId: idSchema,
  date: optionalDate,
  diplomaModelId: idSchema.nullable().optional(),
  disabled: optionalBoolean,
});

export const positioningScoreSchema = z.object({
  enrollmentId: idSchema,
  writtenExpression: scoreSchema,
  writtenComprehension: scoreSchema,
});

export const deliberationEntrySchema = z.object({
  enrollmentId: idSchema,
  oralExpression: scoreSchema,
  writtenExpression: scoreSchema,
  oralComprehension: scoreSchema,
  writtenComprehension: scoreSchema,
});

/** Saisie en masse depuis la grille : une ligne par inscription. */
export const deliberationBulkSchema = z.object({
  entries: z.array(deliberationEntrySchema).min(1, 'Aucune ligne à enregistrer'),
});

export const positioningBulkSchema = z.object({
  scores: z.array(positioningScoreSchema).min(1, 'Aucune ligne à enregistrer'),
});

// ---------------------------------------------------------------------------
// Groupes : actions
// ---------------------------------------------------------------------------

export const organizeGroupsSchema = z.object({
  type: groupTypeSchema.default('SESSION'),
});

export const organizeByLevelSchema = z.object({
  capacity: z.coerce.number().int().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Paiement
// ---------------------------------------------------------------------------

export const paymentReceiptSchema = z.object({
  participantId: idSchema,
  trainingSessionId: idSchema.nullable().optional(),
  paymentDate: optionalDate,
  amount: z.coerce.number().min(0, 'Montant invalide'),
  memo: optionalText,
  disabled: optionalBoolean,
});

// ---------------------------------------------------------------------------
// Utilisateurs
// ---------------------------------------------------------------------------

export const userSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide'),
  name: z.string().trim().min(1, 'Nom requis'),
  role: z.enum(['MANAGER', 'USER', 'ADMIN']),
  password: z.string().min(10, 'Mot de passe : 10 caractères minimum').optional(),
  active: optionalBoolean,
});

export const loginSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});
