'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiUpload } from '@/lib/api/client';
import { Spinner } from './feedback';

export interface ImportReport {
  rows?: number;
  participantsCreated?: number;
  participantsMatched?: number;
  enrolled?: number;
  skipped?: number;
  updated?: number;
  unmatched?: string[];
  issues?: Array<{ line: number; message: string }>;
}

/**
 * Import Excel/CSV.
 *
 * Le rapport est affiché intégralement : lignes ignorées et matricules sans
 * correspondance sont listés, jamais avalés silencieusement — c'est la seule
 * façon de corriger un fichier.
 */
export function ImportButton({
  url,
  label,
  disabled,
  onImported,
}: {
  url: string;
  label: string;
  disabled?: boolean;
  onImported: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPending(true);
    setReport(null);
    setError(null);
    try {
      setReport(await apiUpload<ImportReport>(url, file));
      onImported();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import impossible.');
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const summary: string[] = [];
  if (report) {
    if (report.participantsCreated) summary.push(`${report.participantsCreated} créé(s)`);
    if (report.participantsMatched) summary.push(`${report.participantsMatched} rapproché(s)`);
    if (report.enrolled !== undefined) summary.push(`${report.enrolled} inscrit(s)`);
    if (report.updated !== undefined) summary.push(`${report.updated} note(s) mise(s) à jour`);
    if (report.skipped) summary.push(`${report.skipped} ignoré(s)`);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFile}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled || pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? <Spinner /> : <Upload />}
        {label}
      </Button>

      {error ? (
        <p role="status" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {report ? (
        <div role="status" className="space-y-1 rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">{summary.join(' · ') || 'Aucune ligne exploitable.'}</p>

          {report.unmatched && report.unmatched.length > 0 ? (
            <p className="text-destructive">
              Matricules sans correspondance : {report.unmatched.join(', ')}
            </p>
          ) : null}

          {report.issues && report.issues.length > 0 ? (
            <ul className="list-inside list-disc text-muted-foreground">
              {report.issues.map((issue) => (
                <li key={`${issue.line}-${issue.message}`}>
                  Ligne {issue.line} : {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
