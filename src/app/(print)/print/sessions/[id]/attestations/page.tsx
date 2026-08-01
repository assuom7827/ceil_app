import { PrintToolbar } from '@/components/documents/print-toolbar';
import { AttestationSheet } from '@/components/documents/sheets';
import { prisma } from '@/lib/prisma';
import { getAttestationDocument } from '@/services/documents';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('documentsTab.attestationsTitle') };
}

export default async function AttestationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enrollmentId?: string }>;
}) {
  const t = await getTranslations();
  const [{ id }, { enrollmentId }] = await Promise.all([params, searchParams]);
  const { header, people } = await getAttestationDocument(prisma, id, enrollmentId);

  return (
    <>
      <PrintToolbar
        title={t('documentsTab.attestationsTitle')}
        subtitle={`${header.sessionTitle} — ${people.length} ${t('common.noData').toLowerCase()}`}
      />
      {people.length === 0 ? (
        <p className="print-sheet flex items-center justify-center text-center text-sm">
          {t('documentsTab.attestationsBlocked')}
        </p>
      ) : (
        people.map((person) => (
          <AttestationSheet key={person.enrollmentId} header={header} person={person} />
        ))
      )}
    </>
  );
}
