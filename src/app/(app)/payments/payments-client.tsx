'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResourceManager } from '@/components/crud/resource-manager';
import type { ResourceRecord } from '@/components/crud/fields';
import { ApiError, apiPost } from '@/lib/api/client';
import { deriveParticipantFullName, deriveSessionTitle } from '@/services/derive';

/**
 * Le cycle DRAFT → CONFIRMED ne passe pas par le formulaire : il s'agit
 * d'actions dédiées, qui datent le paiement et refusent une double
 * confirmation.
 */
function ReceiptActions({ row, onDone }: { row: ResourceRecord; onDone: () => void }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const confirmed = row['state'] === 'CONFIRMED';

  async function act(action: 'confirm' | 'reset-to-draft') {
    setPending(true);
    setError(null);
    try {
      await apiPost(`/api/payment-receipts/${String(row['id'])}/${action}`);
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Action impossible.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => act(confirmed ? 'reset-to-draft' : 'confirm')}
      >
        {confirmed ? 'Repasser en brouillon' : 'Confirmer'}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

export function PaymentsClient({ canWrite }: { canWrite: boolean }) {
  // Forcer le rechargement de la liste après une action de cycle.
  const [version, setVersion] = React.useState(0);

  return (
    <ResourceManager
      key={version}
      endpoint="/api/payment-receipts"
      title="Reçus de paiement"
      description="Le numéro PAY-{année}-{n} est attribué automatiquement à la création."
      canWrite={canWrite}
      searchPlaceholder="Numéro ou libellé…"
      rowLabel={(row) => String(row['receiptNumber'] ?? '')}
      columns={[
        { key: 'receiptNumber', header: 'Numéro' },
        {
          key: 'participant',
          header: 'Participant',
          render: (row) => {
            const participant = row['participant'];
            if (!participant || typeof participant !== 'object') return '—';
            return deriveParticipantFullName(participant as never) || '—';
          },
        },
        {
          key: 'trainingSession',
          header: 'Session',
          render: (row) => {
            const session = row['trainingSession'];
            if (!session || typeof session !== 'object') return '—';
            return deriveSessionTitle(session as never) || '—';
          },
        },
        { key: 'amount', header: 'Montant', align: 'end' },
        { key: 'paymentDate', header: 'Date' },
        {
          key: 'state',
          header: 'État',
          render: (row) => (
            <Badge variant={row['state'] === 'CONFIRMED' ? 'success' : 'outline'}>
              {row['state'] === 'CONFIRMED' ? 'Confirmé' : 'Brouillon'}
            </Badge>
          ),
        },
        ...(canWrite
          ? [
              {
                key: 'cycle',
                header: 'Cycle',
                align: 'end' as const,
                render: (row: ResourceRecord) => (
                  <ReceiptActions row={row} onDone={() => setVersion((v) => v + 1)} />
                ),
              },
            ]
          : []),
      ]}
      fields={[
        {
          kind: 'reference',
          name: 'participantId',
          label: 'Participant',
          required: true,
          endpoint: '/api/participants',
          optionLabel: (item: ResourceRecord) =>
            `${deriveParticipantFullName(item as never) || '(sans nom)'} — ${String(item['registrationNumber'] ?? '')}`,
        },
        {
          kind: 'reference',
          name: 'trainingSessionId',
          label: 'Session',
          endpoint: '/api/sessions',
          optionLabel: (item: ResourceRecord) =>
            deriveSessionTitle(item as never) || String(item['code'] ?? item['id']),
        },
        { kind: 'number', name: 'amount', label: 'Montant', required: true },
        { kind: 'date', name: 'paymentDate', label: 'Date de paiement' },
        { kind: 'textarea', name: 'memo', label: 'Libellé' },
        { kind: 'checkbox', name: 'disabled', label: 'Désactivé' },
      ]}
    />
  );
}
