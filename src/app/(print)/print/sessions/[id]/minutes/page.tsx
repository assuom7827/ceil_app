import { PrintToolbar } from '@/components/documents/print-toolbar';
import { MinutesSheets } from '@/components/documents/sheets';
import { prisma } from '@/lib/prisma';
import { getMinutesDocument } from '@/services/documents';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('documentsTab.minutesTitle') };
}

export default async function MinutesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ levelId?: string }>;
}) {
  const t = await getTranslations();
  const { id } = await params;
  const { levelId } = await searchParams;
  const { header, people } = await getMinutesDocument(prisma, id, levelId);

  const levelSuffix = levelId && people.length > 0
    ? ` — ${people[0]!.levelName ?? '—'}`
    : '';

  return (
    <>
      <PrintToolbar
        title={t('documentsTab.minutesTitle')}
        subtitle={`${header.sessionTitle}${levelSuffix} — ${people.length} ${t('common.noData').toLowerCase()}`}
      />
      <MinutesSheets header={header} people={people} />
    </>
  );
}
