import { route } from '@/lib/api/handler';
import { CERTIFICATE_PLACEHOLDERS, unknownPlaceholders } from '@/services/certificates';
import { notFoundError } from '@/services/errors';
import { listTemplatePlaceholders } from '@/services/odt';

/**
 * Repères réellement présents dans le gabarit en place.
 *
 * La liste est **relue depuis le fichier** à chaque appel, jamais stockée : un
 * gabarit remplacé ne doit pas laisser derrière lui la liste du précédent.
 */
export const GET = route<{ id: string }>(
  { resource: 'DiplomaModel', access: 'read' },
  async ({ db, params }) => {
    const template = await db.documentTemplate.findUnique({
      where: { diplomaModelId_kind: { diplomaModelId: params.id, kind: 'CERTIFICATE' } },
      select: { fileName: true, content: true, updatedAt: true },
    });
    if (!template) {
      throw notFoundError('Aucun gabarit d’attestation pour ce modèle.', { id: params.id });
    }

    const bytes = new Uint8Array(template.content);
    return {
      fileName: template.fileName,
      updatedAt: template.updatedAt,
      byteSize: bytes.byteLength,
      placeholders: listTemplatePlaceholders(bytes),
      unknownPlaceholders: unknownPlaceholders(bytes),
      knownPlaceholders: CERTIFICATE_PLACEHOLDERS,
    };
  },
);
