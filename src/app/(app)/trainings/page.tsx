import type { Metadata } from 'next';
import { requireActor } from '@/lib/auth/session';
import { canWrite } from '@/services/rbac';
import { TrainingsClient } from './trainings-client';

export const metadata: Metadata = { title: 'Formations' };

export default async function TrainingsPage() {
  const actor = await requireActor();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Formations</h1>
        <p className="text-muted-foreground">
          Catalogue des langues enseignées et de leurs niveaux.
        </p>
      </div>
      <TrainingsClient canWrite={canWrite(actor, 'Training')} />
    </main>
  );
}
