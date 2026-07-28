import type { Metadata } from 'next';
import { requireActor } from '@/lib/auth/session';
import { canWrite } from '@/services/rbac';
import { PaymentsClient } from './payments-client';

export const metadata: Metadata = { title: 'Paiements' };

export default async function PaymentsPage() {
  const actor = await requireActor();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paiements</h1>
        <p className="text-muted-foreground">
          Reçus des participants. Le rôle « agent de saisie » est en lecture seule ici.
        </p>
      </div>
      <PaymentsClient canWrite={canWrite(actor, 'PaymentReceipt')} />
    </main>
  );
}
