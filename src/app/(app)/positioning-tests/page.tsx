import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireActor } from '@/lib/auth/session';
import { canWrite } from '@/services/rbac';
import { PositioningTestsClient } from './tests-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('positioningTests.title') };
}

export default async function PositioningTestsPage() {
  const actor = await requireActor();
  const t = await getTranslations();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('positioningTests.title')}</h1>
        <p className="text-muted-foreground">{t('positioningTests.subtitle')}</p>
      </div>
      <PositioningTestsClient canWrite={canWrite(actor, 'PositioningTest')} />
    </main>
  );
}
