import { PrintToolbar } from '@/components/documents/print-toolbar';
import { GroupListSheets } from '@/components/documents/sheets';
import { prisma } from '@/lib/prisma';
import { getGroupListDocument } from '@/services/documents';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('documentsTab.listTitle') };
}

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ groupId?: string }>;
}) {
  const t = await getTranslations();
  const [{ id }, { groupId }] = await Promise.all([params, searchParams]);
  const document = await getGroupListDocument(prisma, id, groupId);

  return (
    <>
      <PrintToolbar
        title={t('documentsTab.listTitle')}
        subtitle={`${document.header.sessionTitle}${document.group ? ` — ${document.group.name}` : ''}`}
      />
      <GroupListSheets {...document} />
    </>
  );
}
