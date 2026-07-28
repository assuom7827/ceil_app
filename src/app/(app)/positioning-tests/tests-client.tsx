'use client';

import { ResourceManager } from '@/components/crud/resource-manager';
import type { ResourceRecord } from '@/components/crud/fields';

export function PositioningTestsClient({ canWrite }: { canWrite: boolean }) {
  return (
    <ResourceManager
      endpoint="/api/positioning-tests"
      title="Tests de positionnement"
      description="Un test porte sur une formation ; ses notes se saisissent depuis l’espace de travail d’une session."
      canWrite={canWrite}
      rowLabel={(row) => String(row['title'] ?? 'Test sans titre')}
      columns={[
        { key: 'title', header: 'Titre' },
        { key: 'training.frName', header: 'Formation' },
        { key: 'date', header: 'Date' },
        {
          key: 'state',
          header: 'État',
          render: (row) => (row['state'] === 'LOCKED' ? 'Verrouillé' : 'Ouvert'),
        },
        {
          key: '_count.scores',
          header: 'Notes',
          align: 'end',
          render: (row) => {
            const counts = row['_count'];
            if (counts && typeof counts === 'object') {
              return String((counts as Record<string, unknown>)['scores'] ?? 0);
            }
            return '0';
          },
        },
      ]}
      fields={[
        { kind: 'text', name: 'title', label: 'Titre' },
        {
          kind: 'reference',
          name: 'trainingId',
          label: 'Formation',
          required: true,
          endpoint: '/api/trainings',
          optionLabel: (item: ResourceRecord) => String(item['frName'] ?? ''),
        },
        { kind: 'date', name: 'date', label: 'Date' },
        {
          kind: 'reference',
          name: 'diplomaModelId',
          label: 'Modèle de document',
          endpoint: '/api/diploma-models',
          optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
        },
        { kind: 'checkbox', name: 'disabled', label: 'Désactivé' },
      ]}
    />
  );
}
