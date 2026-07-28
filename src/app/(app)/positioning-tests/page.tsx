import type { Metadata } from 'next';
import { requireActor } from '@/lib/auth/session';
import { canWrite } from '@/services/rbac';
import { PositioningTestsClient } from './tests-client';

export const metadata: Metadata = { title: 'Tests de positionnement' };

export default async function PositioningTestsPage() {
  const actor = await requireActor();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tests de positionnement</h1>
        <p className="text-muted-foreground">
          Le niveau est déterminé par la somme des deux notes écrites (E.E + C.E).
        </p>
      </div>
      <PositioningTestsClient canWrite={canWrite(actor, 'PositioningTest')} />
    </main>
  );
}
