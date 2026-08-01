import { PrintToolbar } from '@/components/documents/print-toolbar';
import { prisma } from '@/lib/prisma';
import { findCertificateTemplate } from '@/services/certificates';
import { getAttestationDocument } from '@/services/documents';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

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

  const template = await findCertificateTemplate(prisma, id, 'ATTESTATION');

  if (!template) {
    return (
      <>
        <PrintToolbar
          title={t('documentsTab.attestationsTitle')}
          subtitle={header.sessionTitle}
        />
        <p className="print-sheet flex items-center justify-center text-center text-sm">
          Aucun gabarit d&apos;attestation d&apos;inscription n&apos;est configuré pour cette session.
          Ajoutez-en un depuis Référentiels → Documents.
        </p>
      </>
    );
  }

  if (enrollmentId) {
    redirect(`/api/sessions/${id}/attestation?enrollmentId=${enrollmentId}`);
  }

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
          <a
            key={person.enrollmentId}
            href={`/api/sessions/${id}/attestation?enrollmentId=${person.enrollmentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="print-sheet"
          >
            <p className="text-center text-sm">
              {person.fullName} — {t('enrollmentsTab.printAttestation')}
            </p>
          </a>
        ))
      )}
    </>
  );
}
