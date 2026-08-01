import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireActor } from '@/lib/auth/session';
import { canWrite } from '@/services/rbac';
import { TrainingsClient } from './trainings-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('trainings.title') };
}

export default async function TrainingsPage() {
  const actor = await requireActor();
  const t = await getTranslations();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('trainings.title')}</h1>
        <p className="text-muted-foreground">{t('trainings.subtitle')}</p>
      </div>
      <TrainingsClient canWrite={canWrite(actor, 'Training')} />
    </main>
  );
}
