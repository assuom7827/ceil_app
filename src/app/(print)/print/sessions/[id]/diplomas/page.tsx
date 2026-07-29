import type { Metadata } from 'next';
import { PrintToolbar } from '@/components/documents/print-toolbar';
import { DiplomaSheet } from '@/components/documents/sheets';
import { prisma } from '@/lib/prisma';
import { getDiplomaDocument } from '@/services/documents';

export const metadata: Metadata = { title: 'Diplômes' };

/** `?enrollmentId=` imprime un diplôme unique ; sans lui, tous les admis. */
export default async function DiplomasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enrollmentId?: string }>;
}) {
  const [{ id }, { enrollmentId }] = await Promise.all([params, searchParams]);
  const { header, people } = await getDiplomaDocument(prisma, id, enrollmentId);

  return (
    <>
      <PrintToolbar title="Diplômes" subtitle={`${header.sessionTitle} — ${people.length} admis`} />
      {people.length === 0 ? (
        <p className="print-sheet flex items-center justify-center text-center text-sm">
          Aucun admis dans cette session : aucun diplôme à imprimer.
        </p>
      ) : (
        people.map((person) => (
          <DiplomaSheet key={person.enrollmentId} header={header} person={person} />
        ))
      )}
    </>
  );
}
