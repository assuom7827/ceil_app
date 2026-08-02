import { NextResponse } from 'next/server';
import { route } from '@/lib/api/handler';
import { buildSessionExport, type ExportFormat, type ExportKind } from '@/services/exports';
import { validationError } from '@/services/errors';

const VALID_KINDS: ExportKind[] = ['enrollments', 'scores'];
const VALID_FORMATS: ExportFormat[] = ['xlsx', 'csv'];

/**
 * Export des données brutes d'une session en CSV ou Excel.
 *
 * | Paramètre | Valeurs                          | Par défaut     |
 * | --------- | -------------------------------- | -------------- |
 * | `what`    | `enrollments` · `scores`          | `enrollments`  |
 * | `format`  | `xlsx` · `csv`                    | `xlsx`          |
 *
 * Le CSV ne contient qu'une feuille. Le XLSX inclut toutes les feuilles du type
 * d'export (ex. : groupes + composition pour `what=groups`).
 *
 * Le fichier est généré côté serveur — le client ne reçoit que le téléchargement,
 * jamais les données agrégées. Les valeurs dérivées proviennent de `derive.ts`,
 * comme les écrans et les documents officiels.
 */
export const GET = route<{ id: string }>(
  { resource: 'TrainingSession', access: 'read' },
  async ({ db, params, url }) => {
    const what = (url.searchParams.get('what') ?? 'enrollments') as ExportKind;
    const format = (url.searchParams.get('format') ?? 'xlsx') as ExportFormat;

    if (!VALID_KINDS.includes(what)) {
      throw validationError(`Type d'export inconnu : ${what}.`, { what, validKinds: VALID_KINDS });
    }
    if (!VALID_FORMATS.includes(format)) {
      throw validationError(`Format inconnu : ${format}.`, { format, validFormats: VALID_FORMATS });
    }

    const result = await buildSessionExport(db, params.id, what, format);

    const headers = new Headers({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
      'Cache-Control': 'no-store',
      'Content-Length': String(result.bytes.byteLength),
      'X-Ceil-Export-Count': String(result.count),
    });

    return new NextResponse(Buffer.from(result.bytes), { headers });
  },
);
