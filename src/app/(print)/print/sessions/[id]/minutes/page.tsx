import type { Metadata } from 'next';
import { PrintToolbar } from '@/components/documents/print-toolbar';
import { MinutesSheets } from '@/components/documents/sheets';
import { prisma } from '@/lib/prisma';
import { getMinutesDocument } from '@/services/documents';

export const metadata: Metadata = { title: 'Procès-verbal de délibération' };

export default async function MinutesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ levelId?: string }>;
}) {
  const { id } = await params;
  const { levelId } = await searchParams;
  const { header, people } = await getMinutesDocument(prisma, id, levelId);

  const levelSuffix = levelId && people.length > 0
    ? ` — ${people[0]!.levelName ?? '—'}`
    : '';

  return (
    <>
      <PrintToolbar
        title="Procès-verbal de délibération"
        subtitle={`${header.sessionTitle}${levelSuffix} — ${people.length} inscrit(s)`}
      />
      <MinutesSheets header={header} people={people} />
    </>
  );
}
