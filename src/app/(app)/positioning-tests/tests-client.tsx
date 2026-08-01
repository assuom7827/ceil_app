'use client';

import { useTranslations } from 'next-intl';
import { ResourceManager } from '@/components/crud/resource-manager';
import type { ResourceRecord } from '@/components/crud/fields';

export function PositioningTestsClient({ canWrite }: { canWrite: boolean }) {
  const t = useTranslations();
  return (
    <ResourceManager
      endpoint="/api/positioning-tests"
      title={t('positioningTests.title')}
      description={t('positioningTests.description')}
      canWrite={canWrite}
      rowLabel={(row) => String(row['title'] ?? t('positioningTests.noTitle'))}
      columns={[
        { key: 'title', header: t('positioningTests.colTitle') },
        { key: 'training.frName', header: t('positioningTests.colTraining') },
        { key: 'date', header: t('positioningTests.colDate') },
        {
          key: 'state',
          header: t('positioningTests.colState'),
          render: (row) =>
            row['state'] === 'LOCKED'
              ? t('positioningTests.stateLocked')
              : t('positioningTests.stateOpen'),
        },
        {
          key: '_count.scores',
          header: t('positioningTests.colScores'),
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
        { kind: 'text', name: 'title', label: t('positioningTests.fieldTitle') },
        {
          kind: 'reference',
          name: 'trainingId',
          label: t('positioningTests.fieldTraining'),
          required: true,
          endpoint: '/api/trainings',
          optionLabel: (item: ResourceRecord) => String(item['frName'] ?? ''),
        },
        { kind: 'date', name: 'date', label: t('positioningTests.fieldDate') },
        {
          kind: 'reference',
          name: 'diplomaModelId',
          label: t('positioningTests.fieldModel'),
          endpoint: '/api/diploma-models',
          optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
        },
        { kind: 'checkbox', name: 'disabled', label: t('positioningTests.fieldDisabled') },
      ]}
    />
  );
}
