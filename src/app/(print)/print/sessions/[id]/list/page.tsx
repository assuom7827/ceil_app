import type { Metadata } from 'next';
import { PrintToolbar } from '@/components/documents/print-toolbar';
import { GroupListSheets } from '@/components/documents/sheets';
import { prisma } from '@/lib/prisma';
import { getGroupListDocument } from '@/services/documents';

export const metadata: Metadata = { title: 'Liste des participants' };

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ groupId?: string }>;
}) {
  const [{ id }, { groupId }] = await Promise.all([params, searchParams]);
  const document = await getGroupListDocument(prisma, id, groupId);

  return (
    <>
      <PrintToolbar
        title="Liste des participants"
        subtitle={`${document.header.sessionTitle}${document.group ? ` — ${document.group.name}` : ''}`}
      />
      <GroupListSheets {...document} />
    </>
  );
}
