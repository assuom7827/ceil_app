import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireActor } from '@/lib/auth/session';
import { canWrite } from '@/services/rbac';
import { PaymentsClient } from './payments-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('payments.title') };
}

export default async function PaymentsPage() {
  const actor = await requireActor();
  const t = await getTranslations();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('payments.title')}</h1>
        <p className="text-muted-foreground">{t('payments.subtitle')}</p>
      </div>
      <PaymentsClient canWrite={canWrite(actor, 'PaymentReceipt')} />
    </main>
  );
}
