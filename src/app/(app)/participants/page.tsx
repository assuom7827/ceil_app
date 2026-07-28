import type { Metadata } from 'next';
import { requireActor } from '@/lib/auth/session';
import { canWrite } from '@/services/rbac';
import { ParticipantsClient } from './participants-client';

export const metadata: Metadata = { title: 'Participants' };

export default async function ParticipantsPage() {
  const actor = await requireActor();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Participants</h1>
        <p className="text-muted-foreground">
          Le matricule est attribué automatiquement à la création.
        </p>
      </div>
      <ParticipantsClient canWrite={canWrite(actor, 'Participant')} />
    </main>
  );
}
