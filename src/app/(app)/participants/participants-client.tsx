'use client';

import { ResourceManager } from '@/components/crud/resource-manager';
import type { FieldDef, ResourceRecord } from '@/components/crud/fields';
import { useTranslations } from 'next-intl';
import { deriveBirthDisplay, deriveParticipantFullName } from '@/services/derive';

export function ParticipantsClient({ canWrite }: { canWrite: boolean }) {
  const t = useTranslations();

  const columns = [
    { key: 'registrationNumber', header: t('participants.colRegistrationNumber') },
    {
      key: 'fullName',
      header: t('participants.colFullName'),
      render: (row: ResourceRecord) => deriveParticipantFullName(row as never) || '—',
    },
    {
      key: 'birthDate',
      header: t('participants.colBirthDate'),
      render: (row: ResourceRecord) => {
        const display = deriveBirthDisplay({
          birthDate: row['birthDate'] as string | Date | null | undefined,
          birthDateIsApproximate: row['birthDateIsApproximate'] as boolean | null | undefined,
          approximateBirth: row['approximateBirth'] as string | null | undefined,
        });
        return display || '—';
      },
    },
    {
      key: 'type',
      header: t('participants.colType'),
      render: (row: ResourceRecord) => (row['type'] === 'TEACHER' ? t('participantType.teacher') : t('participantType.student')),
    },
    { key: 'phone', header: t('participants.colPhone') },
    { key: 'faculty.name', header: t('participants.colFaculty') },
  ];

  const fields: FieldDef[] = [
    {
      kind: 'select',
      name: 'type',
      label: t('participants.fieldType'),
      required: true,
      options: [
        { value: 'STUDENT', label: t('participantType.student') },
        { value: 'TEACHER', label: t('participantType.teacher') },
      ],
    },
    { kind: 'text', name: 'familyName', label: t('participants.fieldFamilyName') },
    { kind: 'text', name: 'firstName', label: t('participants.fieldFirstName') },
    { kind: 'text', name: 'arabName', label: t('participants.fieldArabName') },
    { kind: 'text', name: 'arabFirstName', label: t('participants.fieldArabFirstName') },
    { kind: 'date', name: 'birthDate', label: t('participants.fieldBirthDate') },
    { kind: 'text', name: 'birthPlace', label: t('participants.fieldBirthPlace') },
    { kind: 'text', name: 'arabBirthPlace', label: t('participants.fieldArabBirthPlace') },
    {
      kind: 'checkbox',
      name: 'birthDateIsApproximate',
      label: t('participants.fieldBirthApproxCheckbox'),
      help: t('participants.fieldBirthApproxHelp'),
    },
    {
      kind: 'text',
      name: 'approximateBirth',
      label: t('participants.fieldApproximateBirth'),
      placeholder: t('participants.fieldApproximateBirthPlaceholder'),
    },
    {
      kind: 'select',
      name: 'gender',
      label: t('participants.fieldGender'),
      options: [
        { value: 'WOMAN', label: t('gender.woman') },
        { value: 'MAN', label: t('gender.man') },
      ],
    },
    { kind: 'text', name: 'phone', label: t('participants.fieldPhone') },
    { kind: 'text', name: 'email', label: t('participants.fieldEmail') },
    {
      kind: 'reference',
      name: 'facultyId',
      label: t('participants.fieldFaculty'),
      endpoint: '/api/faculties',
      optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
    },
    {
      kind: 'multiReference',
      name: 'categoryIds',
      label: t('participants.fieldCategories'),
      endpoint: '/api/student-categories',
      optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
    },
    { kind: 'textarea', name: 'note', label: t('participants.fieldNote') },
  ];

  return (
    <ResourceManager
      endpoint="/api/participants"
      title={t('participants.title')}
      description={t('participants.description')}
      canWrite={canWrite}
      searchPlaceholder={t('participants.searchPlaceholder')}
      rowLabel={(row) =>
        deriveParticipantFullName(row as never) || String(row['registrationNumber'])
      }
      columns={columns}
      fields={fields}
    />
  );
}
