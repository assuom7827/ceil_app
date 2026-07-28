'use client';

import * as React from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiPatch, apiPost } from '@/lib/api/client';
import { FeedbackBanner, Spinner, useAction } from './feedback';
import type { AdmissionSummary, WorkspacePermissions, WorkspaceSession } from './types';

export interface SessionHeaderProps {
  session: WorkspaceSession;
  permissions: WorkspacePermissions;
  counters: { enrollments: number; groups: number; admission: AdmissionSummary | null };
  onSessionChanged: (patch: Partial<WorkspaceSession>) => void;
}

export function SessionHeader({
  session,
  permissions,
  counters,
  onSessionChanged,
}: SessionHeaderProps) {
  const { pending, feedback, run } = useAction();
  const [threshold, setThreshold] = React.useState(String(session.admissionThreshold));
  const locked = session.state === 'LOCKED';

  React.useEffect(() => {
    setThreshold(String(session.admissionThreshold));
  }, [session.admissionThreshold]);

  async function toggleLock() {
    await run(async () => {
      const action = locked ? 'unlock' : 'lock';
      await apiPost(`/api/sessions/${session.id}/${action}`);
      onSessionChanged({ state: locked ? 'OPEN' : 'LOCKED' });
      return locked ? 'Session déverrouillée.' : 'Session verrouillée.';
    });
  }

  async function saveThreshold() {
    const value = Number(threshold.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      setThreshold(String(session.admissionThreshold));
      return;
    }
    if (value === session.admissionThreshold) return;

    await run(async () => {
      await apiPatch(`/api/sessions/${session.id}`, {
        trainingId: undefined,
        admissionThreshold: value,
      });
      onSessionChanged({ admissionThreshold: value });
      return `Seuil d’admission fixé à ${value}.`;
    });
  }

  return (
    <header className="space-y-4 border-b pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
            <Badge variant={locked ? 'outline' : 'secondary'} data-testid="session-state">
              {locked ? 'Verrouillée' : 'Ouverte'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {session.trainingName}
            {session.levelName ? ` · ${session.levelName}` : ''}
            {session.academicYear ? ` · ${session.academicYear}` : ''}
            {session.matriculePrefix ? ` · matricules ${session.matriculePrefix}-…` : ''}
          </p>
        </div>

        {permissions.session ? (
          <Button variant={locked ? 'outline' : 'destructive'} onClick={toggleLock} disabled={pending}>
            {pending ? <Spinner /> : locked ? <LockOpen /> : <Lock />}
            {locked ? 'Déverrouiller' : 'Verrouiller'}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-1">
          <Label htmlFor="threshold" className="text-xs text-muted-foreground">
            Seuil d’admission
          </Label>
          <Input
            id="threshold"
            value={threshold}
            inputMode="decimal"
            disabled={!permissions.session || locked || pending}
            onChange={(event) => setThreshold(event.target.value)}
            onBlur={saveThreshold}
            className="h-9 w-24 text-end"
          />
        </div>

        <Counter label="Inscrits" value={counters.enrollments} />
        <Counter label="Groupes" value={counters.groups} />
        <Counter label="Admis" value={counters.admission?.admitted ?? null} />
        <Counter label="Ajournés" value={counters.admission?.refused ?? null} />
        <Counter label="Non délibérés" value={counters.admission?.pending ?? null} muted />
      </div>

      <FeedbackBanner feedback={feedback} />

      {locked ? (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Session verrouillée : les grilles sont en lecture seule. Déverrouillez-la pour reprendre
          la saisie.
        </p>
      ) : null}
    </header>
  );
}

function Counter({ label, value, muted }: { label: string; value: number | null; muted?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${muted ? 'text-muted-foreground' : ''}`}>
        {value ?? '—'}
      </p>
    </div>
  );
}
