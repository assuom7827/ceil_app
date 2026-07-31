import { NextResponse } from 'next/server';
import { route } from '@/lib/api/handler';
import { buildCertificateOdt } from '@/services/certificates';
import { odtToPdf } from '@/services/odt-render';

/**
 * Attestations de réussite, remplies depuis le gabarit ODT du modèle de la
 * session. Une page par admis, un seul fichier — éditer cent attestations une
 * par une n'est pas un geste tenable.
 *
 * | Paramètre      | Effet                                                     |
 * | -------------- | --------------------------------------------------------- |
 * | `enrollmentId` | Une seule attestation, celle de cette inscription         |
 * | `format=odt`   | Rend l'ODT rempli au lieu du PDF, pour retouche manuelle  |
 *
 * Le filtre d'admission est celui du service : un ajourné ne peut pas recevoir
 * d'attestation de réussite par cette route.
 */
export const GET = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'read' },
  async ({ db, params, url }) => {
    const enrollmentId = url.searchParams.get('enrollmentId') ?? undefined;
    const wantsOdt = url.searchParams.get('format') === 'odt';

    const built = await buildCertificateOdt(db, params.id, enrollmentId);
    const base = built.count === 1 ? 'attestation' : 'attestations';

    if (wantsOdt) {
      return download(built.file, `${base}.odt`, 'application/vnd.oasis.opendocument.text', built);
    }
    return download(await odtToPdf(built.file), `${base}.pdf`, 'application/pdf', built);
  },
);

/**
 * Renvoie le fichier, en signalant les repères non résolus dans un en-tête.
 *
 * Le corps d'une réponse binaire ne peut pas porter de rapport ; sans cet
 * en-tête, un repère resté visible sur un document officiel ne serait découvert
 * qu'à l'impression.
 */
function download(
  bytes: Uint8Array,
  fileName: string,
  contentType: string,
  built: { count: number; unresolved: string[] },
): NextResponse {
  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Cache-Control': 'no-store',
    'X-Ceil-Certificates': String(built.count),
  });
  if (built.unresolved.length > 0) {
    headers.set('X-Ceil-Unresolved', built.unresolved.join(','));
  }
  return new NextResponse(new Uint8Array(bytes), { headers });
}
