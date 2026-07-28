'use client';

import * as React from 'react';
import { Calculator, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditableGrid, type GridColumn } from '@/components/grid/editable-grid';
import { apiGet, apiPut, apiPost } from '@/lib/api/client';
import {
  deriveEntryTotalAndStatus,
  deriveParticipantFullName,
  type AdmissionStatus,
} from '@/services/derive';
import { FeedbackBanner, Spinner, useAction } from './feedback';
import { ImportButton } from './import-button';
import type { AdmissionSummary, DeliberationPayload, DeliberationRow } from './types';

/** Les 4 compétences, dans l'ordre officiel du procès-verbal. */
const SCORE_FIELDS = [
  { key: 'oralExpression', header: 'E.O' },
  { key: 'writtenExpression', header: 'E.E' },
  { key: 'oralComprehension', header: 'C.O' },
  { key: 'writtenComprehension', header: 'C.E' },
] as const;

type ScoreField = (typeof SCORE_FIELDS)[number]['key'];

/** Brouillon de saisie : les valeurs restent en texte tant qu'on édite. */
type Draft = Record<ScoreField, string>;

function toDraft(row: DeliberationRow): Draft {
  return {
    oralExpression: row.oralExpression?.toString() ?? '',
    writtenExpression: row.writtenExpression?.toString() ?? '',
    oralComprehension: row.oralComprehension?.toString() ?? '',
    writtenComprehension: row.writtenComprehension?.toString() ?? '',
  };
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function validateScore(value: string): string | null {
  if (value.trim() === '') return null;
  const parsed = toNumber(value);
  if (parsed === null) return 'Nombre attendu';
  if (parsed < 0) return 'Négatif';
  return null;
}

export function DeliberationTab({
  sessionId,
  canWrite,
  locked,
  onAdmissionChange,
}: {
  sessionId: string;
  canWrite: boolean;
  locked: boolean;
  onAdmissionChange: (summary: AdmissionSummary) => void;
}) {
  const [payload, setPayload] = React.useState<DeliberationPayload | null>(null);
  const [drafts, setDrafts] = React.useState<Map<string, Draft>>(new Map());
  const [dirty, setDirty] = React.useState<Set<string>>(new Set());
  const { pending, feedback, setFeedback, run } = useAction();

  const load = React.useCallback(async () => {
    const data = await apiGet<DeliberationPayload>(`/api/sessions/${sessionId}/deliberation`);
    setPayload(data);
    setDrafts(new Map(data.rows.map((row) => [row.enrollmentId, toDraft(row)])));
    setDirty(new Set());
  }, [sessionId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleChange = React.useCallback((rowId: string, key: string, value: string) => {
    setDrafts((previous) => {
      const current = previous.get(rowId);
      if (!current) return previous;
      const next = new Map(previous);
      next.set(rowId, { ...current, [key as ScoreField]: value });
      return next;
    });
    setDirty((previous) => new Set(previous).add(rowId));
  }, []);

  const threshold = payload?.admissionThreshold ?? 50;

  /**
   * Total et statut sont calculés ICI, dans le navigateur, par la MÊME fonction
   * que le serveur (`deriveEntryTotalAndStatus`). Aucune règle d'admission n'est
   * réécrite côté client, donc aucune divergence possible.
   */
  const computed = React.useCallback(
    (row: DeliberationRow): { total: number | null; status: AdmissionStatus | null } => {
      const draft = drafts.get(row.enrollmentId);
      if (!draft) return { total: row.total, status: row.status };

      return deriveEntryTotalAndStatus(
        {
          oralExpression: toNumber(draft.oralExpression),
          writtenExpression: toNumber(draft.writtenExpression),
          oralComprehension: toNumber(draft.oralComprehension),
          writtenComprehension: toNumber(draft.writtenComprehension),
        },
        threshold,
      );
    },
    [drafts, threshold],
  );

  const columns = React.useMemo<Array<GridColumn<DeliberationRow>>>(() => {
    const definitions: Array<GridColumn<DeliberationRow>> = [
      {
        key: 'registrationNumber',
        header: 'Matricule',
        kind: 'computed',
        get: (row) => row.enrollmentNumber ?? row.participant.registrationNumber,
      },
      {
        key: 'fullName',
        header: 'Participant',
        kind: 'computed',
        get: (row) => deriveParticipantFullName(row.participant),
      },
      {
        key: 'level',
        header: 'Niveau',
        kind: 'computed',
        get: (row) => row.assignedLevel?.name ?? '—',
      },
    ];

    for (const field of SCORE_FIELDS) {
      definitions.push({
        key: field.key,
        header: field.header,
        kind: 'number',
        align: 'end',
        get: (row) => drafts.get(row.enrollmentId)?.[field.key] ?? '',
        validate: validateScore,
      });
    }

    definitions.push(
      {
        key: 'total',
        header: 'Total',
        kind: 'computed',
        align: 'end',
        get: (row) => computed(row).total?.toString() ?? '—',
        render: (row) => (
          <span className="font-semibold tabular-nums">{computed(row).total ?? '—'}</span>
        ),
      },
      {
        key: 'status',
        header: 'Statut',
        kind: 'computed',
        get: (row) => computed(row).status ?? '',
        render: (row) => {
          const { status } = computed(row);
          if (status === null) {
            return <span className="text-xs text-muted-foreground">Non délibéré</span>;
          }
          return (
            <Badge variant={status === 'ADMITTED' ? 'success' : 'destructive'}>
              {status === 'ADMITTED' ? 'Admis' : 'Ajourné'}
            </Badge>
          );
        },
      },
    );

    return definitions;
  }, [computed, drafts]);

  async function saveAll() {
    if (!payload || dirty.size === 0) return;

    await run(async () => {
      const entries = [...dirty].flatMap((enrollmentId) => {
        const draft = drafts.get(enrollmentId);
        if (!draft) return [];
        return [
          {
            enrollmentId,
            oralExpression: toNumber(draft.oralExpression),
            writtenExpression: toNumber(draft.writtenExpression),
            oralComprehension: toNumber(draft.oralComprehension),
            writtenComprehension: toNumber(draft.writtenComprehension),
          },
        ];
      });

      await apiPut(`/api/sessions/${sessionId}/deliberation`, { entries });
      await load();
      return `${entries.length} ligne(s) enregistrée(s).`;
    });
  }

  async function recompute() {
    await run(async () => {
      const summary = await apiPost<AdmissionSummary>(
        `/api/sessions/${sessionId}/deliberation/recompute`,
      );
      onAdmissionChange(summary);
      return `${summary.admitted} admis · ${summary.refused} ajourné(s) · ${summary.pending} non délibéré(s) (seuil ${summary.admissionThreshold}).`;
    });
  }

  if (!payload) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner /> Chargement de la délibération…
      </p>
    );
  }

  const editable = canWrite && !locked;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={saveAll} disabled={!editable || pending || dirty.size === 0}>
            {pending ? <Spinner /> : <Save />}
            Enregistrer tout {dirty.size > 0 ? `(${dirty.size})` : ''}
          </Button>
          <Button variant="outline" onClick={recompute} disabled={pending}>
            <Calculator />
            Recalculer les résultats
          </Button>
        </div>

        <ImportButton
          url={`/api/sessions/${sessionId}/deliberation/import-scores`}
          label="Importer les notes"
          disabled={!editable}
          onImported={() => {
            void load();
            setFeedback(null);
          }}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Seuil d’admission : <strong>{threshold}</strong>. Total et statut sont calculés en direct
        par la même fonction que le serveur. Collez directement depuis Excel : la sélection se
        remplit vers la droite et vers le bas.
      </p>

      <FeedbackBanner feedback={feedback} />

      <EditableGrid
        rows={payload.rows}
        rowId={(row) => row.enrollmentId}
        columns={columns}
        onChange={handleChange}
        readOnly={!editable}
        dirtyRowIds={dirty}
        emptyLabel="Aucun inscrit à délibérer. Commencez par inscrire des participants."
      />
    </div>
  );
}
