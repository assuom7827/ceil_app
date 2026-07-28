import type { Metadata } from 'next';
import { PrintToolbar } from '@/components/documents/print-toolbar';
import { MinutesSheets } from '@/components/documents/sheets';
import { prisma } from '@/lib/prisma';
import { getMinutesDocument } from '@/services/documents';

export const metadata: Metadata = { title: 'Procès-verbal de délibération' };

export default async function MinutesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { header, people } = await getMinutesDocument(prisma, id);

  return (
    <>
      <PrintToolbar
        title="Procès-verbal de délibération"
        subtitle={`${header.sessionTitle} — ${people.length} inscrit(s)`}
      />
      <MinutesSheets header={header} people={people} />
    </>
  );
}
