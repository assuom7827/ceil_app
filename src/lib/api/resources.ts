/**
 * Configuration CRUD de chaque ressource, en un seul endroit.
 * Les fichiers de route se contentent d'en ré-exporter les handlers.
 */
import type { CrudConfig } from './crud';
import {
  diplomaModelSchema,
  facultySchema,
  participantSchema,
  paymentReceiptSchema,
  positioningTestSchema,
  specialitySchema,
  studentCategorySchema,
  studentGroupSchema,
  teacherSchema,
  trainingLevelSchema,
  trainingSchema,
  trainingSessionSchema,
} from '@/lib/validation/schemas';

// Participant et PaymentReceipt ne figurent pas ici pour leur création : leur
// matricule doit être alloué dans la même transaction, ce que la fabrique
// générique ne sait pas faire. Voir leurs handlers `POST` dédiés.

/** Remplace intégralement une relation M2N (jamais de cumul implicite). */
function setRelation(ids: string[] | undefined) {
  return ids ? { set: ids.map((id) => ({ id })) } : undefined;
}

function connectRelation(ids: string[] | undefined) {
  return ids && ids.length > 0 ? { connect: ids.map((id) => ({ id })) } : undefined;
}

export const facultyCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'Faculty',
  delegate: (db) => db.faculty,
  schema: facultySchema,
  searchable: ['name', 'description'],
  sortable: ['name', 'createdAt'],
  defaultOrderBy: { name: 'asc' },
};

export const specialityCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'Speciality',
  delegate: (db) => db.speciality,
  schema: specialitySchema,
  searchable: ['name', 'arName'],
  sortable: ['name', 'createdAt'],
  defaultOrderBy: { name: 'asc' },
};

export const teacherCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'Teacher',
  delegate: (db) => db.teacher,
  schema: teacherSchema,
  searchable: ['name', 'email', 'phone'],
  sortable: ['name', 'teacherType', 'createdAt'],
  defaultOrderBy: { name: 'asc' },
};

export const studentCategoryCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'StudentCategory',
  delegate: (db) => db.studentCategory,
  schema: studentCategorySchema,
  searchable: ['name'],
  sortable: ['name', 'createdAt'],
  defaultOrderBy: { name: 'asc' },
};

export const trainingLevelCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'TrainingLevel',
  delegate: (db) => db.trainingLevel,
  schema: trainingLevelSchema,
  searchable: ['name'],
  sortable: ['sequence', 'name', 'minimumPoints'],
  defaultOrderBy: { sequence: 'asc' },
};

export const diplomaModelCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'DiplomaModel',
  delegate: (db) => db.diplomaModel,
  schema: diplomaModelSchema,
  searchable: ['name'],
  sortable: ['name', 'createdAt'],
  defaultOrderBy: { name: 'asc' },
  /**
   * Métadonnées du gabarit, SANS son contenu : le fichier ODT ne doit jamais
   * traverser une réponse de liste, où il serait sérialisé en base64 pour chaque
   * modèle. Il se télécharge par sa route dédiée.
   */
  include: {
    templates: { select: { id: true, kind: true, fileName: true, updatedAt: true } },
  },
  /**
   * Deux invariants, impossibles à exprimer en contrainte de base :
   *   — au plus UN modèle par défaut actif ;
   *   — un modèle désactivé ne peut pas rester le modèle par défaut.
   */
  afterWrite: async (db, record) => {
    const model = record as { id: string; isDefault: boolean; disabled: boolean };

    if (model.disabled && model.isDefault) {
      return db.diplomaModel.update({ where: { id: model.id }, data: { isDefault: false } });
    }

    if (model.isDefault) {
      await db.diplomaModel.updateMany({
        where: { id: { not: model.id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    return model;
  },
};

export const trainingCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'Training',
  delegate: (db) => db.training,
  schema: trainingSchema,
  searchable: ['frName', 'arName', 'code'],
  sortable: ['frName', 'code', 'createdAt'],
  defaultOrderBy: { frName: 'asc' },
  include: { levels: { orderBy: { sequence: 'asc' } } },
  softDisable: false,
  toCreateData: ({ levelIds, ...rest }) => ({
    ...rest,
    levels: connectRelation(levelIds as string[] | undefined),
  }),
  toUpdateData: ({ levelIds, ...rest }) => ({
    ...rest,
    levels: setRelation(levelIds as string[] | undefined),
  }),
  /**
   * Les formations désactivées sont invisibles pour le rôle `USER` uniquement.
   * `ADMIN` et `MANAGER` voient toujours l'ensemble du catalogue, y compris
   * les formations désactivées.
   */
  listFilter: (actor) => {
    if (actor.role === 'ADMIN' || actor.role === 'MANAGER') {
      return {};
    }
    return { disabled: false };
  },
};

export const participantCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'Participant',
  delegate: (db) => db.participant,
  schema: participantSchema,
  searchable: ['familyName', 'firstName', 'arabName', 'registrationNumber', 'phone', 'email'],
  sortable: ['familyName', 'firstName', 'registrationNumber', 'createdAt'],
  defaultOrderBy: { familyName: 'asc' },
  include: { faculty: true, categories: true },
  // Un participant n'a pas de `disabled` : on ne filtre pas dessus.
  softDisable: false,
  toCreateData: ({ categoryIds, ...rest }) => ({
    ...rest,
    categories: connectRelation(categoryIds as string[] | undefined),
  }),
  toUpdateData: ({ categoryIds, ...rest }) => ({
    ...rest,
    categories: setRelation(categoryIds as string[] | undefined),
  }),
};

export const trainingSessionCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'TrainingSession',
  delegate: (db) => db.trainingSession,
  schema: trainingSessionSchema,
  searchable: ['code', 'academicYear', 'matriculePrefix'],
  sortable: ['academicYear', 'dateFrom', 'createdAt'],
  defaultOrderBy: { createdAt: 'desc' },
  include: {
    training: true,
    trainingLevel: true,
    diplomaModel: true,
    _count: { select: { enrollments: true, groups: true } },
  },
};

export const studentGroupCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'StudentGroup',
  delegate: (db) => db.studentGroup,
  schema: studentGroupSchema,
  updateSchema: studentGroupSchema.partial(),
  searchable: ['name', 'site'],
  sortable: ['name', 'sequence', 'createdAt'],
  defaultOrderBy: { sequence: 'asc' },
  include: { teacher: true, trainingLevel: true },
};

export const positioningTestCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'PositioningTest',
  delegate: (db) => db.positioningTest,
  schema: positioningTestSchema,
  searchable: ['title'],
  sortable: ['date', 'createdAt'],
  defaultOrderBy: { createdAt: 'desc' },
  include: { training: true, diplomaModel: true, _count: { select: { scores: true } } },
};

export const paymentReceiptCrud: CrudConfig<Record<string, unknown>> = {
  resource: 'PaymentReceipt',
  delegate: (db) => db.paymentReceipt,
  schema: paymentReceiptSchema,
  searchable: ['receiptNumber', 'memo'],
  sortable: ['receiptNumber', 'paymentDate', 'amount', 'createdAt'],
  defaultOrderBy: { createdAt: 'desc' },
  include: { participant: true, trainingSession: true },
};
