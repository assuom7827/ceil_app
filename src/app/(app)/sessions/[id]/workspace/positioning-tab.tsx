'use client';

import * as React from 'react';
import { Save, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { EditableGrid, type GridColumn } from '@/components/grid/editable-grid';
import { apiGet, apiPost, apiPut } from '@/lib/api/client';
import { deriveParticipantFullName, derivePositioning } from '@/services/derive';
import { FeedbackBanner, Spinner, useAction } from './feedback';
import { ImportButton } from './import-button';
import type { NamedRef, PositioningPayload, PositioningRow } from './types';

interface Draft {
  writtenExpression: string;
  writtenComprehension: string;
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Le barème complet est nécessaire au calcul du niveau : on le reconstruit à
 * partir des niveaux renvoyés par le serveur, enrichis de leurs bornes.
 */
interface LevelInterval extends NamedRef {
  sequence: number;
  minimumPoints: number;
  maximumPoints: number;
}

export function PositioningTab({
  sessionId,
  canWrite,
  locked,
}: {
  sessionId: string;
  canWrite: boolean;
  locked: boolean;
}) {
  const [tests, setTests] = React.useState<PositioningPayload['tests']>([]);
  const [testId, setTestId] = React.useState<string>('');
  const [payload, setPayload] = React.useState<PositioningPayload | null>(null);
  const [levels, setLevels] = React.useState<LevelInterval[]>([]);
  const [drafts, setDrafts] = React.useState<Map<string, Draft>>(new Map());
  const [dirty, setDirty] = React.useState<Set<string>>(new Set());
  const { pending, feedback, run } = useAction();

  React.useEffect(() => {
    void (async () => {
      const [list, levelPage] = await Promise.all([
        apiGet<PositioningPayload>(`/api/sessions/${sessionId}/positioning`),
        apiGet<{ data: LevelInterval[] }>('/api/training-levels?perPage=100&sort=sequence'),
      ]);
      setTests(list.tests ?? []);
      setLevels(levelPage.data);
      const first = list.tests?.[0];
      if (first) setTestId(first.id);
    })();
  }, [sessionId]);

  const load = React.useCallback(async () => {
    if (!testId) return;
    const data = await apiGet<PositioningPayload>(
      `/api/sessions/${sessionId}/positioning?testId=${testId}`,
    );
    setPayload(data);
    setDrafts(
      new Map(
        data.rows.map((row) => [
          row.enrollmentId,
          {
            writtenExpression: row.writtenExpression?.toString() ?? '',
            writtenComprehension: row.writtenComprehension?.toString() ?? '',
          },
        ]),
      ),
    );
    setDirty(new Set());
  }, [sessionId, testId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleChange = React.useCallback((rowId: string, key: string, value: string) => {
    setDrafts((previous) => {
      const current = previous.get(rowId);
      if (!current) return previous;
      const next = new Map(previous);
      next.set(rowId, { ...current, [key as keyof Draft]: value });
      return next;
    });
    setDirty((previous) => new Set(previous).add(rowId));
  }, []);

  /** Total et niveau résolu calculés par les fonctions dérivées du serveur. */
  const computed = React.useCallback(
    (row: PositioningRow) => {
      const draft = drafts.get(row.enrollmentId);
      return derivePositioning(
        {
          writtenExpression: toNumber(draft?.writtenExpression ?? ''),
          writtenComprehension: toNumber(draft?.writtenComprehension ?? ''),
        },
        levels,
      );
    },
    [drafts, levels],
  );

  const columns = React.useMemo<Array<GridColumn<PositioningRow>>>(
    () => [
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
        key: 'writtenExpression',
        header: 'E.E',
        kind: 'number',
        align: 'end',
        get: (row) => drafts.get(row.enrollmentId)?.writtenExpression ?? '',
      },
      {
        key: 'writtenComprehension',
        header: 'C.E',
        kind: 'number',
        align: 'end',
        get: (row) => drafts.get(row.enrollmentId)?.writtenComprehension ?? '',
      },
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
        key: 'resolvedLevel',
        header: 'Niveau résolu',
        kind: 'computed',
        get: (row) => computed(row).resolvedLevel?.name ?? '—',
      },
      {
        key: 'assignedLevel',
        header: 'Niveau attribué',
        kind: 'computed',
        get: (row) => row.assignedLevel?.name ?? '—',
      },
    ],
    [computed, drafts],
  );

  async function saveAll() {
    if (!testId || dirty.size === 0) return;

    await run(async () => {
      const scores = [...dirty].flatMap((enrollmentId) => {
        const draft = drafts.get(enrollmentId);
        if (!draft) return [];
        return [
          {
            enrollmentId,
            writtenExpression: toNumber(draft.writtenExpression),
            writtenComprehension: toNumber(draft.writtenComprehension),
          },
        ];
      });

      await apiPut(`/api/positioning-tests/${testId}/scores`, { scores });
      await load();
      return `${scores.length} note(s) enregistrée(s).`;
    });
  }

  async function resolveLevels() {
    if (!testId) return;

    await run(async () => {
      const result = await apiPost<{
        updated: number;
        total: number;
        unresolved: number;
        skippedLocked: number;
      }>(`/api/positioning-tests/${testId}/resolve-levels`);
      await load();

      const parts = [`${result.updated} niveau(x) attribué(s) sur ${result.total} note(s)`];
      if (result.unresolved > 0) parts.push(`${result.unresolved} hors barème ou sans note`);
      if (result.skippedLocked > 0) parts.push(`${result.skippedLocked} en session verrouillée`);
      return parts.join(' · ');
    });
  }

  if (tests?.length === 0) {
    return (
      <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
        Aucun test de positionnement pour la formation de cette session. Créez-en un via{' '}
        <code>POST /api/positioning-tests</code> ; l’écran de gestion des tests arrive à l’étape 7.
      </p>
    );
  }

  const editable = canWrite && !locked && payload?.readOnly !== true;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="test-select" className="text-xs text-muted-foreground">
              Test de positionnement
            </Label>
            <select
              id="test-select"
              value={testId}
              onChange={(event) => setTestId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            >
              {tests?.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.title ?? 'Test sans titre'}
                  {test.state === 'LOCKED' ? ' (verrouillé)' : ''}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={saveAll} disabled={!editable || pending || dirty.size === 0}>
            {pending ? <Spinner /> : <Save />}
            Enregistrer tout {dirty.size > 0 ? `(${dirty.size})` : ''}
          </Button>

          <Button variant="outline" onClick={resolveLevels} disabled={!editable || pending}>
            <Wand2 />
            Déterminer les niveaux
          </Button>
        </div>

        <ImportButton
          url={testId ? `/api/positioning-tests/${testId}/import-scores` : ''}
          label="Importer les notes"
          disabled={!editable || !testId}
          onImported={load}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Total = E.E + C.E. Le niveau résolu applique l’intervalle semi-ouvert de chaque niveau ;
        « Déterminer les niveaux » l’inscrit dans le niveau attribué de chaque inscription.
      </p>

      <FeedbackBanner feedback={feedback} />

      {payload ? (
        <EditableGrid
          rows={payload.rows}
          rowId={(row) => row.enrollmentId}
          columns={columns}
          onChange={handleChange}
          readOnly={!editable}
          dirtyRowIds={dirty}
          emptyLabel="Aucun inscrit dans cette session."
        />
      ) : (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Spinner /> Chargement…
        </p>
      )}
    </div>
  );
}
