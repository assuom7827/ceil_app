import { NextResponse } from 'next/server';
import { route } from '@/lib/api/handler';
import { buildAttestationOdt } from '@/services/certificates';
import { odtToPdf } from '@/services/odt-render';
import { assertSessionAccess } from '@/services/locking';

export const GET = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'read' },
  async ({ db, params, url, actor }) => {
    await assertSessionAccess(db, params.id, actor);
    const enrollmentId = url.searchParams.get('enrollmentId') ?? undefined;

    const built = await buildAttestationOdt(db, params.id, enrollmentId);
    const base = built.count === 1 ? 'attestation-inscription' : 'attestations-inscription';
    const pdfBytes = await odtToPdf(built.file);
    const fileName = `${base}.pdf`;

    const headers = new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'no-store',
      'Content-Length': String(pdfBytes.byteLength),
      'X-Ceil-Certificates': String(built.count),
    });

    return new NextResponse(Buffer.from(pdfBytes), { headers });
  },
);
