'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations();
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
      setError(caught instanceof ApiError ? caught.message : t('payments.actionImpossible'));
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
        {confirmed ? t('payments.resetToDraft') : t('payments.confirm')}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

export function PaymentsClient({ canWrite }: { canWrite: boolean }) {
  const t = useTranslations();
  // Forcer le rechargement de la liste après une action de cycle.
  const [version, setVersion] = React.useState(0);

  return (
    <ResourceManager
      key={version}
      endpoint="/api/payment-receipts"
      title={t('payments.resourceTitle')}
      description={t('payments.resourceDescription')}
      canWrite={canWrite}
      searchPlaceholder={t('payments.searchPlaceholder')}
      rowLabel={(row) => String(row['receiptNumber'] ?? '')}
      columns={[
        { key: 'receiptNumber', header: t('payments.colNumber') },
        {
          key: 'participant',
          header: t('payments.colParticipant'),
          render: (row) => {
            const participant = row['participant'];
            if (!participant || typeof participant !== 'object') return '—';
            return deriveParticipantFullName(participant as never) || '—';
          },
        },
        {
          key: 'trainingSession',
          header: t('payments.colSession'),
          render: (row) => {
            const session = row['trainingSession'];
            if (!session || typeof session !== 'object') return '—';
            return deriveSessionTitle(session as never) || '—';
          },
        },
        { key: 'amount', header: t('payments.colAmount'), align: 'end' },
        { key: 'paymentDate', header: t('payments.colDate') },
        {
          key: 'state',
          header: t('payments.colState'),
          render: (row) => (
            <Badge variant={row['state'] === 'CONFIRMED' ? 'success' : 'outline'}>
              {row['state'] === 'CONFIRMED' ? t('payments.confirmed') : t('payments.draft')}
            </Badge>
          ),
        },
        ...(canWrite
          ? [
              {
                key: 'cycle',
                header: t('payments.colCycle'),
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
          label: t('payments.fieldParticipant'),
          required: true,
          endpoint: '/api/participants',
          optionLabel: (item: ResourceRecord) =>
            `${deriveParticipantFullName(item as never) || t('payments.noName')} — ${String(item['registrationNumber'] ?? '')}`,
        },
        {
          kind: 'reference',
          name: 'trainingSessionId',
          label: t('payments.fieldSession'),
          endpoint: '/api/sessions',
          optionLabel: (item: ResourceRecord) =>
            deriveSessionTitle(item as never) || String(item['code'] ?? item['id']),
        },
        { kind: 'number', name: 'amount', label: t('payments.fieldAmount'), required: true },
        { kind: 'date', name: 'paymentDate', label: t('payments.fieldPaymentDate') },
        { kind: 'textarea', name: 'memo', label: t('payments.fieldMemo') },
        { kind: 'checkbox', name: 'disabled', label: t('payments.fieldDisabled') },
      ]}
    />
  );
}
