'use client';

import { ResourceManager } from '@/components/crud/resource-manager';
import type { ResourceRecord } from '@/components/crud/fields';
import { deriveBirthDisplay, deriveParticipantFullName } from '@/services/derive';

export function ParticipantsClient({ canWrite }: { canWrite: boolean }) {
  return (
    <ResourceManager
      endpoint="/api/participants"
      title="Participants"
      description="Personnes indépendantes des sessions : le niveau et le groupe appartiennent à l'inscription."
      canWrite={canWrite}
      searchPlaceholder="Nom, prénom, matricule, téléphone…"
      rowLabel={(row) =>
        deriveParticipantFullName(row as never) || String(row['registrationNumber'])
      }
      columns={[
        { key: 'registrationNumber', header: 'Matricule' },
        {
          key: 'fullName',
          header: 'Nom complet',
          // Dérivé par la même fonction que le serveur.
          render: (row) => deriveParticipantFullName(row as never) || '—',
        },
        {
          key: 'birthDate',
          header: 'Date de naissance',
          render: (row) => {
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
          header: 'Type',
          render: (row) => (row['type'] === 'TEACHER' ? 'Enseignant' : 'Étudiant'),
        },
        { key: 'phone', header: 'Téléphone' },
        { key: 'faculty.name', header: 'Faculté' },
      ]}
      fields={[
        {
          kind: 'select',
          name: 'type',
          label: 'Type',
          required: true,
          options: [
            { value: 'STUDENT', label: 'Étudiant' },
            { value: 'TEACHER', label: 'Enseignant' },
          ],
        },
        { kind: 'text', name: 'familyName', label: 'Nom' },
        { kind: 'text', name: 'firstName', label: 'Prénom' },
        { kind: 'text', name: 'arabName', label: 'Nom arabe' },
        { kind: 'text', name: 'arabFirstName', label: 'Prénom arabe' },
        { kind: 'date', name: 'birthDate', label: 'Date de naissance' },
        { kind: 'text', name: 'birthPlace', label: 'Lieu de naissance' },
        { kind: 'text', name: 'arabBirthPlace', label: 'Lieu de naissance (arabe)' },
        {
          kind: 'checkbox',
          name: 'birthDateIsApproximate',
          label: 'Date de naissance approximative',
          help: 'Si coché, la mention ci-dessous est affichée à la place de la date.',
        },
        {
          kind: 'text',
          name: 'approximateBirth',
          label: 'Naissance approximative',
          placeholder: 'vers 1998',
        },
        {
          kind: 'select',
          name: 'gender',
          label: 'Genre',
          options: [
            { value: 'WOMAN', label: 'Femme' },
            { value: 'MAN', label: 'Homme' },
          ],
        },
        { kind: 'text', name: 'phone', label: 'Téléphone' },
        { kind: 'text', name: 'email', label: 'E-mail' },
        {
          kind: 'reference',
          name: 'facultyId',
          label: 'Faculté',
          endpoint: '/api/faculties',
          optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
        },
        {
          kind: 'multiReference',
          name: 'categoryIds',
          label: 'Catégories',
          endpoint: '/api/student-categories',
          optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
        },
        { kind: 'textarea', name: 'note', label: 'Note' },
      ]}
    />
  );
}
