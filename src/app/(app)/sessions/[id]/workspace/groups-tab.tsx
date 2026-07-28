'use client';

import * as React from 'react';
import { LayoutGrid, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiGet, apiPost } from '@/lib/api/client';
import { FeedbackBanner, Spinner, useAction } from './feedback';
import type { GroupRow } from './types';

export function GroupsTab({
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
  const [groups, setGroups] = React.useState<GroupRow[] | null>(null);
  const [capacity, setCapacity] = React.useState('');
  const { pending, feedback, run } = useAction();

  const load = React.useCallback(async () => {
    const rows = await apiGet<GroupRow[]>(`/api/sessions/${sessionId}/groups/organize-by-level`);
    setGroups(rows);
    onCountChange(rows.length);
  }, [onCountChange, sessionId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function organizeByLevel() {
    await run(async () => {
      const query = capacity.trim() ? `?capacity=${encodeURIComponent(capacity.trim())}` : '';
      const result = await apiPost<{
        created: number;
        removed: number;
        capacity: number;
        withoutLevel: number;
        byLevel: Array<{ levelName: string; enrollments: number; groups: number }>;
      }>(`/api/sessions/${sessionId}/groups/organize-by-level${query}`);
      await load();

      const detail = result.byLevel
        .map((level) => `${level.levelName} : ${level.enrollments} → ${level.groups} groupe(s)`)
        .join(' · ');
      const warning =
        result.withoutLevel > 0
          ? ` · ${result.withoutLevel} inscrit(s) sans niveau attribué (positionnement à faire)`
          : '';
      return `${result.created} groupe(s) ouvert(s) à ${result.capacity} places. ${detail}${warning}`;
    });
  }

  async function assignByLevel() {
    await run(async () => {
      const result = await apiPost<{ assigned: number; unassigned: number; withoutLevel: number }>(
        `/api/sessions/${sessionId}/groups/assign-by-level`,
      );
      await load();

      const parts = [`${result.assigned} inscrit(s) réparti(s)`];
      if (result.unassigned > 0) parts.push(`${result.unassigned} sans place`);
      if (result.withoutLevel > 0) parts.push(`${result.withoutLevel} sans niveau attribué`);
      return parts.join(' · ');
    });
  }

  async function organizeExam() {
    await run(async () => {
      const result = await apiPost<{ created: number; removed: number }>(
        `/api/sessions/${sessionId}/groups/organize?type=EXAM`,
      );
      await load();
      return `${result.created} salle(s) d’examen instanciée(s) depuis les gabarits.`;
    });
  }

  async function assignExam() {
    await run(async () => {
      const result = await apiPost<{ assigned: number; unassigned: number }>(
        `/api/sessions/${sessionId}/groups/assign-exam`,
      );
      await load();
      return `${result.assigned} inscrit(s) réparti(s)${
        result.unassigned > 0 ? ` · ${result.unassigned} sans place` : ''
      }.`;
    });
  }

  if (!groups) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner /> Chargement des groupes…
      </p>
    );
  }

  const editable = canWrite && !locked;
  const sessionGroups = groups.filter((group) => group.groupType === 'SESSION');
  const examGroups = groups.filter((group) => group.groupType === 'EXAM');

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-md border p-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <LayoutGrid className="size-4" />
            Groupes de session, par niveau
          </h2>
          <p className="text-sm text-muted-foreground">
            À lancer après le test de positionnement : chaque niveau reçoit autant de groupes que
            l’effectif l’exige.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="capacity" className="text-xs text-muted-foreground">
              Places par groupe
            </Label>
            <Input
              id="capacity"
              value={capacity}
              inputMode="numeric"
              placeholder="gabarit"
              onChange={(event) => setCapacity(event.target.value)}
              className="h-9 w-28"
            />
          </div>
          <Button onClick={organizeByLevel} disabled={!editable || pending}>
            {pending ? <Spinner /> : null}
            Ouvrir les groupes
          </Button>
          <Button variant="outline" onClick={assignByLevel} disabled={!editable || pending}>
            <Users />
            Répartir les inscrits
          </Button>
        </div>

        <GroupTable groups={sessionGroups} emptyLabel="Aucun groupe de session ouvert." showLevel />
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <div>
          <h2 className="font-semibold">Salles d’examen</h2>
          <p className="text-sm text-muted-foreground">
            Indifférentes au niveau : elles se remplissent par ordre alphabétique, pour des listes
            d’émargement exploitables en salle.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={organizeExam} disabled={!editable || pending}>
            Organiser depuis les gabarits
          </Button>
          <Button variant="outline" onClick={assignExam} disabled={!editable || pending}>
            <Users />
            Répartir
          </Button>
        </div>

        <GroupTable groups={examGroups} emptyLabel="Aucune salle d’examen." />
      </section>

      <FeedbackBanner feedback={feedback} />
    </div>
  );
}

function GroupTable({
  groups,
  emptyLabel,
  showLevel,
}: {
  groups: GroupRow[];
  emptyLabel: string;
  showLevel?: boolean;
}) {
  if (groups.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Groupe</TableHead>
          {showLevel ? <TableHead>Niveau</TableHead> : null}
          <TableHead>Enseignant</TableHead>
          <TableHead>Site</TableHead>
          <TableHead className="text-end">Effectif</TableHead>
          <TableHead className="text-end">Capacité</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const full = group.capacity !== null && group.count >= group.capacity;
          return (
            <TableRow key={group.id}>
              <TableCell className="py-2 font-medium">{group.name}</TableCell>
              {showLevel ? (
                <TableCell>
                  {group.trainingLevel ? (
                    <Badge variant="secondary">{group.trainingLevel.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              ) : null}
              <TableCell className="text-muted-foreground">{group.teacher?.name ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{group.site ?? '—'}</TableCell>
              <TableCell className="text-end tabular-nums">
                <span className={full ? 'font-semibold text-destructive' : undefined}>
                  {group.count}
                </span>
              </TableCell>
              <TableCell className="text-end tabular-nums text-muted-foreground">
                {group.capacity ?? '∞'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
