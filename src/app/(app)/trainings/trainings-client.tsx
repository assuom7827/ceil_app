'use client';

import { ResourceManager } from '@/components/crud/resource-manager';
import type { ResourceRecord } from '@/components/crud/fields';

export function TrainingsClient({ canWrite }: { canWrite: boolean }) {
  return (
    <ResourceManager
      endpoint="/api/trainings"
      title="Formations"
      description="Chaque formation propose une sélection de niveaux CECRL."
      canWrite={canWrite}
      searchPlaceholder="Nom français, arabe ou code…"
      rowLabel={(row) => String(row['frName'] ?? '')}
      columns={[
        { key: 'frName', header: 'Nom' },
        { key: 'arName', header: 'Nom arabe' },
        { key: 'code', header: 'Code' },
        {
          key: 'levels',
          header: 'Niveaux',
          render: (row) => {
            const levels = row['levels'];
            if (!Array.isArray(levels) || levels.length === 0) return '—';
            return `${levels.length} niveau(x)`;
          },
        },
        { key: 'disabled', header: 'Désactivée' },
      ]}
      fields={[
        { kind: 'text', name: 'frName', label: 'Nom français', required: true },
        { kind: 'text', name: 'arName', label: 'Nom arabe' },
        { kind: 'text', name: 'code', label: 'Code', placeholder: 'ANG' },
        { kind: 'textarea', name: 'description', label: 'Description' },
        {
          kind: 'multiReference',
          name: 'levelIds',
          label: 'Niveaux proposés',
          endpoint: '/api/training-levels',
          optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
          help: 'La sélection remplace intégralement les niveaux existants.',
        },
        { kind: 'checkbox', name: 'disabled', label: 'Désactivée' },
      ]}
    />
  );
}
