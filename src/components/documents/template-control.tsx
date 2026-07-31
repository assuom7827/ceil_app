'use client';

import * as React from 'react';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError, apiDelete } from '@/lib/api/client';
import { CERTIFICATE_PLACEHOLDERS } from '@/services/certificate-placeholders';

interface UploadReport {
  fileName: string;
  byteSize: number;
  placeholders: string[];
  unknownPlaceholders: string[];
}

/**
 * Gabarit ODT d'un modèle de diplôme : téléverser, télécharger, retirer.
 *
 * Le téléchargement n'est pas un ornement : on modifie une attestation en
 * repartant du fichier **en place**, pas d'une copie locale qui a pu diverger.
 */
export function TemplateControl({
  modelId,
  fileName,
  updatedAt,
  canWrite,
}: {
  modelId: string;
  fileName: string | null;
  updatedAt: string | null;
  canWrite: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [current, setCurrent] = React.useState<{ fileName: string; updatedAt: string } | null>(
    fileName ? { fileName, updatedAt: updatedAt ?? '' } : null,
  );
  const [pending, setPending] = React.useState(false);
  const [report, setReport] = React.useState<UploadReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showHelp, setShowHelp] = React.useState(false);

  const endpoint = `/api/diploma-models/${modelId}/template`;

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPending(true);
    setError(null);
    setReport(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(endpoint, { method: 'POST', body });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = (payload as { message?: string }).message;
        throw new Error(message ?? 'Téléversement impossible.');
      }
      const saved = payload as UploadReport & { updatedAt: string };
      setReport(saved);
      setCurrent({ fileName: saved.fileName, updatedAt: saved.updatedAt });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Téléversement impossible.');
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove() {
    if (!window.confirm('Retirer le gabarit ? Les attestations repasseront en HTML.')) return;
    setPending(true);
    setError(null);
    try {
      await apiDelete(endpoint);
      setCurrent(null);
      setReport(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Suppression impossible.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".odt,application/vnd.oasis.opendocument.text"
        onChange={upload}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      <div className="flex flex-wrap items-center gap-2">
        {current ? (
          <span className="inline-flex items-center gap-1 text-sm">
            <FileText className="size-4 text-muted-foreground" />
            {current.fileName}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Aucun gabarit</span>
        )}

        {current ? (
          <Button size="sm" variant="ghost" asChild>
            <a href={endpoint} download aria-label={`Télécharger ${current.fileName}`}>
              <Download />
            </a>
          </Button>
        ) : null}

        {canWrite ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <Upload />
              {current ? 'Remplacer' : 'Téléverser'}
            </Button>
            {current ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={remove}
                className="text-destructive"
                aria-label="Retirer le gabarit"
              >
                <Trash2 />
              </Button>
            ) : null}
          </>
        ) : null}

        <Button size="sm" variant="ghost" onClick={() => setShowHelp((shown) => !shown)}>
          {showHelp ? 'Masquer les repères' : 'Repères disponibles'}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {report ? (
        <div role="status" className="space-y-1 rounded-md bg-muted p-2 text-sm">
          <p className="font-medium">
            {report.placeholders.length} repère(s) reconnu(s) — {Math.round(report.byteSize / 1024)}{' '}
            Ko
          </p>
          {report.unknownPlaceholders.length > 0 ? (
            <p className="text-destructive">
              Repères inconnus, qui s’imprimeront tels quels :{' '}
              {report.unknownPlaceholders.map((name) => `{{${name}}}`).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {showHelp ? (
        <div className="rounded-md border bg-card p-3 text-sm">
          <p className="mb-2 text-muted-foreground">
            Écrivez ces repères dans votre fichier LibreOffice ; l’application les remplace à
            l’édition. Tout le reste — logos, cadre, signature — vous appartient.
          </p>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {CERTIFICATE_PLACEHOLDERS.map((entry) => (
              <div key={entry.name} className="flex gap-2">
                <dt className="font-mono text-xs">{`{{${entry.name}}}`}</dt>
                <dd className="text-xs text-muted-foreground">{entry.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
