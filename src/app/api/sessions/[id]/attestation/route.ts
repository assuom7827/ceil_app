import { NextResponse } from 'next/server';
import { route } from '@/lib/api/handler';
import { buildAttestationOdt } from '@/services/certificates';
import { odtToPdf } from '@/services/odt-render';

/**
 * Attestations d'inscription, remplies depuis le gabarit ODT du modèle de la
 * session. Une page par inscrit, un seul fichier.
 *
 * | Paramètre      | Effet                                                     |
 * | -------------- | --------------------------------------------------------- |
 * | `enrollmentId` | Une seule attestation, celle de cette inscription         |
 */
export const GET = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'read' },
  async ({ db, params, url }) => {
    const enrollmentId = url.searchParams.get('enrollmentId') ?? undefined;

    const built = await buildAttestationOdt(db, params.id, enrollmentId);
    const base = built.count === 1 ? 'attestation-inscription' : 'attestations-inscription';
    const bytes = new Uint8Array(await odtToPdf(built.file));

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(`${base}.pdf`)}`,
        'Cache-Control': 'no-store',
        'X-Ceil-Certificates': String(built.count),
      },
    });
  },
);
