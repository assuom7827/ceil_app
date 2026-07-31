import { NextResponse } from 'next/server';
import { readUpload, route } from '@/lib/api/handler';
import { CERTIFICATE_PLACEHOLDERS, unknownPlaceholders } from '@/services/certificates';
import { notFoundError, validationError } from '@/services/errors';
import { listTemplatePlaceholders, readOdt } from '@/services/odt';

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Téléverse le gabarit ODT d'attestation d'un modèle de diplôme.
 *
 * Le fichier est validé **avant** d'être stocké : archive ODT lisible, et liste
 * des repères qu'il contient. Les repères inconnus sont renvoyés dans la réponse
 * plutôt que refusés — une mention libre est légitime, mais une faute de frappe
 * (`{{niveaux}}`) s'imprimerait telle quelle sur un document officiel.
 */
export const POST = route<{ id: string }>(
  { resource: 'DiplomaModel', access: 'write' },
  async ({ db, params, request }) => {
    const model = await db.diplomaModel.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!model) throw notFoundError('Modèle de diplôme introuvable.', { id: params.id });

    const { bytes, fileName } = await readUpload(request);
    if (bytes.byteLength === 0) throw validationError('Fichier vide.');
    if (bytes.byteLength > MAX_BYTES) {
      throw validationError('Gabarit trop volumineux (8 Mo maximum).', {
        byteSize: bytes.byteLength,
      });
    }

    readOdt(bytes); // Lève un 400 explicite si ce n'est pas un ODT.
    const placeholders = listTemplatePlaceholders(bytes);

    const saved = await db.documentTemplate.upsert({
      where: { diplomaModelId_kind: { diplomaModelId: params.id, kind: 'CERTIFICATE' } },
      create: {
        diplomaModelId: params.id,
        kind: 'CERTIFICATE',
        fileName: fileName || 'attestation.odt',
        content: Buffer.from(bytes),
      },
      update: { fileName: fileName || 'attestation.odt', content: Buffer.from(bytes) },
      select: { id: true, fileName: true, updatedAt: true },
    });

    return NextResponse.json(
      {
        ...saved,
        byteSize: bytes.byteLength,
        placeholders,
        unknownPlaceholders: unknownPlaceholders(bytes),
        knownPlaceholders: CERTIFICATE_PLACEHOLDERS,
      },
      { status: 201 },
    );
  },
);

/**
 * Télécharge le gabarit en place.
 *
 * Indispensable au geste demandé : on modifie une attestation en repartant du
 * fichier en production, pas d'une copie locale qui a pu diverger.
 */
export const GET = route<{ id: string }>(
  { resource: 'DiplomaModel', access: 'read' },
  async ({ db, params }) => {
    const template = await db.documentTemplate.findUnique({
      where: { diplomaModelId_kind: { diplomaModelId: params.id, kind: 'CERTIFICATE' } },
      select: { fileName: true, content: true },
    });
    if (!template) {
      throw notFoundError('Aucun gabarit d’attestation pour ce modèle.', { id: params.id });
    }

    return new NextResponse(new Uint8Array(template.content), {
      headers: {
        'Content-Type': 'application/vnd.oasis.opendocument.text',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(template.fileName)}`,
        'Cache-Control': 'no-store',
      },
    });
  },
);

/** Retire le gabarit : les documents HTML reprennent la main. */
export const DELETE = route<{ id: string }>(
  { resource: 'DiplomaModel', access: 'write' },
  async ({ db, params }) => {
    const template = await db.documentTemplate.findUnique({
      where: { diplomaModelId_kind: { diplomaModelId: params.id, kind: 'CERTIFICATE' } },
      select: { id: true },
    });
    if (!template) {
      throw notFoundError('Aucun gabarit d’attestation pour ce modèle.', { id: params.id });
    }
    await db.documentTemplate.delete({ where: { id: template.id } });
    return undefined; // 204
  },
);
