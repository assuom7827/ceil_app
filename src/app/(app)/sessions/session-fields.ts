import type { FieldDef } from '@/components/crud/fields';
import type { ResourceRecord } from '@/components/crud/fields';

export const sessionFormFields: FieldDef[] = [
  {
    kind: 'reference',
    name: 'trainingId',
    label: 'Formation',
    required: true,
    endpoint: '/api/trainings',
    optionLabel: (item: ResourceRecord) => String(item['frName'] ?? ''),
  },
  {
    kind: 'reference',
    name: 'trainingLevelId',
    label: 'Niveau visé',
    endpoint: '/api/training-levels',
    optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
    help: 'Laisser vide pour une session multi-niveaux : chaque groupe portera alors son propre niveau.',
  },
  {
    kind: 'text',
    name: 'academicYear',
    label: 'Année universitaire',
    placeholder: '2025-2026',
  },
  { kind: 'text', name: 'code', label: 'Code' },
  { kind: 'date', name: 'dateFrom', label: 'Début' },
  { kind: 'date', name: 'dateTo', label: 'Fin' },
  {
    kind: 'number',
    name: 'admissionThreshold',
    label: 'Seuil d\u2019admission',
    help: 'Somme des 4 compétences à atteindre. 50 par défaut.',
  },
  {
    kind: 'text',
    name: 'matriculePrefix',
    label: 'Préfixe des matricules',
    placeholder: 'CEIL-ANG-2526',
    help: 'Les inscriptions seront numérotées « préfixe-0001 », uniques dans cette session.',
  },
  {
    kind: 'reference',
    name: 'diplomaModelId',
    label: 'Modèle de diplôme',
    endpoint: '/api/diploma-models',
    optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
  },
];
