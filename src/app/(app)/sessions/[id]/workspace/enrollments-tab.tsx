'use client';

import * as React from 'react';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditableGrid, type GridColumn } from '@/components/grid/editable-grid';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import { deriveParticipantFullName } from '@/services/derive';
import { EnrollDialog } from './enroll-dialog';
import { FeedbackBanner, Spinner, useAction } from './feedback';
import { ImportButton } from './import-button';
import type { EnrollmentRow, EnrollmentsPayload, GroupRow, NamedRef } from './types';

type Draft = {
  kind: string;
  assignedLevelId: string;
  sessionGroupId: string;
  examGroupId: string;
};

function toDraft(row: EnrollmentRow): Draft {
  return {
    kind: row.kind,
    assignedLevelId: row.assignedLevel?.id ?? '',
    sessionGroupId: row.sessionGroup?.id ?? '',
    examGroupId: row.examGroup?.id ?? '',
  };
}

export function EnrollmentsTab({
  sessionId,
  canWrite,
  locked,
  onCountChange,
}: {
  sessionId: string;
  canWrite: boolean;
  locked: boolean;
  onCountChange: (count: number) => void;
}) {
  const [payload, setPayload] = React.useState<EnrollmentsPayload | null>(null);
  const [levels, setLevels] = React.useState<NamedRef[]>([]);
  const [groups, setGroups] = React.useState<GroupRow[]>([]);
  const [drafts, setDrafts] = React.useState<Map<string, Draft>>(new Map());
  const [dirty, setDirty] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const { pending, feedback, run } = useAction();

  const load = React.useCallback(async () => {
    const [enrollments, levelPage, sessionGroups] = await Promise.all([
      apiGet<EnrollmentsPayload>(`/api/sessions/${sessionId}/enrollments`),
      apiGet<{ data: NamedRef[] }>('/api/training-levels?perPage=100&sort=sequence'),
      apiGet<GroupRow[]>(`/api/sessions/${sessionId}/groups/organize-by-level`),
    ]);

    setPayload(enrollments);
    setLevels(levelPage.data);
    setGroups(sessionGroups);
    setDrafts(new Map(enrollments.rows.map((row) => [row.id, toDraft(row)])));
    setDirty(new Set());
    setSelected(new Set());
    onCountChange(enrollments.rows.length);
  }, [onCountChange, sessionId]);

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

  const groupOptions = React.useMemo(
    () => ({
      session: groups
        .filter((group) => group.groupType === 'SESSION')
        .map((group) => ({
          value: group.id,
          label: group.trainingLevel ? `${group.name} · ${group.trainingLevel.name}` : group.name,
        })),
      exam: groups
        .filter((group) => group.groupType === 'EXAM')
        .map((group) => ({ value: group.id, label: group.name })),
    }),
    [groups],
  );

  const columns = React.useMemo<Array<GridColumn<EnrollmentRow>>>(
    () => [
      {
        key: 'registrationNumber',
        header: 'Matricule',
        kind: 'computed',
        get: (row) => row.registrationNumber ?? '—',
      },
      {
        key: 'participantNumber',
        header: 'Matricule participant',
        kind: 'computed',
        get: (row) => row.participant.registrationNumber,
      },
      {
        key: 'fullName',
        header: 'Participant',
        kind: 'computed',
        // Dérivé par la même fonction que le serveur.
        get: (row) => deriveParticipantFullName(row.participant),
      },
      {
        key: 'kind',
        header: 'Type',
        kind: 'select',
        get: (row) => drafts.get(row.id)?.kind ?? row.kind,
        options: [
          { value: 'NEW', label: 'Nouveau' },
          { value: 'RETURNING', label: 'Ancien' },
        ],
      },
      {
        key: 'assignedLevelId',
        header: 'Niveau attribué',
        kind: 'select',
        get: (row) => drafts.get(row.id)?.assignedLevelId ?? '',
        options: levels.map((level) => ({ value: level.id, label: level.name })),
      },
      {
        key: 'sessionGroupId',
        header: 'Groupe session',
        kind: 'select',
        get: (row) => drafts.get(row.id)?.sessionGroupId ?? '',
        options: groupOptions.session,
      },
      {
        key: 'examGroupId',
        header: 'Groupe examen',
        kind: 'select',
        get: (row) => drafts.get(row.id)?.examGroupId ?? '',
        options: groupOptions.exam,
      },
    ],
    [drafts, groupOptions, levels],
  );

  async function saveAll() {
    if (dirty.size === 0) return;

    await run(async () => {
      for (const enrollmentId of dirty) {
        const draft = drafts.get(enrollmentId);
        if (!draft) continue;
        await apiPatch(`/api/enrollments/${enrollmentId}`, {
          kind: draft.kind === '' ? undefined : draft.kind,
          assignedLevelId: draft.assignedLevelId || null,
          sessionGroupId: draft.sessionGroupId || null,
          examGroupId: draft.examGroupId || null,
        });
      }
      const count = dirty.size;
      await load();
      return `${count} inscription(s) mise(s) à jour.`;
    });
  }

  async function removeSelected() {
    if (selected.size === 0) return;

    await run(async () => {
      for (const enrollmentId of selected) {
        await apiDelete(`/api/enrollments/${enrollmentId}`);
      }
      const count = selected.size;
      await load();
      return `${count} inscription(s) retirée(s).`;
    });
  }

  async function assignGroupToSelection(groupType: 'SESSION' | 'EXAM', groupId: string) {
    if (selected.size === 0) return;

    await run(async () => {
      const result = await apiPost<{ updated: number }>(`/api/sessions/${sessionId}/assign-group`, {
        enrollmentIds: [...selected],
        groupType,
        groupId: groupId || null,
      });
      await load();
      return `${result.updated} inscription(s) affectée(s).`;
    });
  }

  if (!payload) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner /> Chargement des inscrits…
      </p>
    );
  }

  const editable = canWrite && !locked;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <EnrollDialog sessionId={sessionId} disabled={!editable} onEnrolled={load} />

          <Button onClick={saveAll} disabled={!editable || pending || dirty.size === 0}>
            {pending ? <Spinner /> : <Save />}
            Enregistrer tout {dirty.size > 0 ? `(${dirty.size})` : ''}
          </Button>

          <Button
            variant="outline"
            onClick={removeSelected}
            disabled={!editable || pending || selected.size === 0}
          >
            <Trash2 />
            Retirer {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </div>

        <ImportButton
          url={`/api/sessions/${sessionId}/import-enrollments`}
          label="Importer des inscrits"
          disabled={!editable}
          onImported={load}
        />
      </div>

      {selected.size > 0 && editable ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3 text-sm">
          <span>{selected.size} sélectionné(s) — affecter en masse :</span>
          <select
            aria-label="Affecter un groupe de session"
            defaultValue=""
            onChange={(event) => {
              void assignGroupToSelection('SESSION', event.target.value);
              event.target.value = '';
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Groupe session…</option>
            <option value="">Aucun</option>
            {groupOptions.session.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Affecter un groupe d’examen"
            defaultValue=""
            onChange={(event) => {
              void assignGroupToSelection('EXAM', event.target.value);
              event.target.value = '';
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Groupe examen…</option>
            {groupOptions.exam.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <FeedbackBanner feedback={feedback} />

      <EditableGrid
        rows={payload.rows}
        rowId={(row) => row.id}
        columns={columns}
        onChange={handleChange}
        readOnly={!editable}
        dirtyRowIds={dirty}
        selection={{
          selected,
          onToggle: (id, checked) =>
            setSelected((previous) => {
              const next = new Set(previous);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            }),
          onToggleAll: (checked) =>
            setSelected(checked ? new Set(payload.rows.map((row) => row.id)) : new Set()),
        }}
        emptyLabel="Aucun inscrit. Utilisez « Inscrire des participants »."
      />
    </div>
  );
}
