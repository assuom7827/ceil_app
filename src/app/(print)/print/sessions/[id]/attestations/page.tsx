import type { Metadata } from 'next';
import { PrintToolbar } from '@/components/documents/print-toolbar';
import { AttestationSheet } from '@/components/documents/sheets';
import { prisma } from '@/lib/prisma';
import { getAttestationDocument } from '@/services/documents';

export const metadata: Metadata = { title: 'Attestations' };

export default async function AttestationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enrollmentId?: string }>;
}) {
  const [{ id }, { enrollmentId }] = await Promise.all([params, searchParams]);
  const { header, people } = await getAttestationDocument(prisma, id, enrollmentId);

  return (
    <>
      <PrintToolbar
        title="Attestations d’inscription"
        subtitle={`${header.sessionTitle} — ${people.length} inscrit(s)`}
      />
      {people.length === 0 ? (
        <p className="print-sheet flex items-center justify-center text-center text-sm">
          Aucun inscrit dans cette session.
        </p>
      ) : (
        people.map((person) => (
          <AttestationSheet key={person.enrollmentId} header={header} person={person} />
        ))
      )}
    </>
  );
}
