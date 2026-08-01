'use client';

import { useTranslations } from 'next-intl';
import { ResourceManager } from '@/components/crud/resource-manager';
import type { ResourceRecord } from '@/components/crud/fields';

export function TrainingsClient({ canWrite }: { canWrite: boolean }) {
  const t = useTranslations();
  return (
    <ResourceManager
      endpoint="/api/trainings"
      title={t('trainings.title')}
      description={t('trainings.description')}
      canWrite={canWrite}
      searchPlaceholder={t('trainings.searchPlaceholder')}
      rowLabel={(row) => String(row['frName'] ?? '')}
      columns={[
        { key: 'frName', header: t('trainings.colName') },
        { key: 'arName', header: t('trainings.colArName') },
        { key: 'code', header: t('trainings.colCode') },
        {
          key: 'levels',
          header: t('trainings.colLevels'),
          render: (row) => {
            const levels = row['levels'];
            if (!Array.isArray(levels) || levels.length === 0) return '—';
            return t('trainings.levelsCount', { count: levels.length });
          },
        },
        { key: 'disabled', header: t('trainings.colDisabled') },
      ]}
      fields={[
        { kind: 'text', name: 'frName', label: t('trainings.fieldFrName'), required: true },
        { kind: 'text', name: 'arName', label: t('trainings.fieldArName') },
        { kind: 'text', name: 'code', label: t('trainings.fieldCode'), placeholder: 'ANG' },
        { kind: 'textarea', name: 'description', label: t('trainings.fieldDescription') },
        {
          kind: 'multiReference',
          name: 'levelIds',
          label: t('trainings.fieldLevels'),
          endpoint: '/api/training-levels',
          optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
          help: t('trainings.fieldLevelsHelp'),
        },
        { kind: 'checkbox', name: 'disabled', label: t('trainings.fieldDisabled') },
      ]}
    />
  );
}
