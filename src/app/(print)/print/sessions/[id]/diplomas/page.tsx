import { PrintToolbar } from '@/components/documents/print-toolbar';
import { DiplomaSheet } from '@/components/documents/sheets';
import { prisma } from '@/lib/prisma';
import { getDiplomaDocument } from '@/services/documents';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('documentsTab.certificatesTitle') };
}

/** `?enrollmentId=` imprime un diplôme unique ; sans lui, tous les admis. */
export default async function DiplomasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enrollmentId?: string }>;
}) {
  const t = await getTranslations();
  const [{ id }, { enrollmentId }] = await Promise.all([params, searchParams]);
  const { header, people } = await getDiplomaDocument(prisma, id, enrollmentId);

  return (
    <>
      <PrintToolbar
        title={t('documentsTab.certificatesTitle')}
        subtitle={`${header.sessionTitle} — ${people.length} ${t('scores.admitted').toLowerCase()}`}
      />
      {people.length === 0 ? (
        <p className="print-sheet flex items-center justify-center text-center text-sm">
          {t('documentsTab.certificatesNoAdmitted')}
        </p>
      ) : (
        people.map((person) => (
          <DiplomaSheet key={person.enrollmentId} header={header} person={person} />
        ))
      )}
    </>
  );
}
