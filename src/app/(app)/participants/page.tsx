import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireActor } from '@/lib/auth/session';
import { canWrite } from '@/services/rbac';
import { ParticipantsClient } from './participants-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('nav.participants') };
}

export default async function ParticipantsPage() {
  const actor = await requireActor();
  const t = await getTranslations();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('participants.title')}</h1>
        <p className="text-muted-foreground">{t('participants.subtitle')}</p>
      </div>
      <ParticipantsClient canWrite={canWrite(actor, 'Participant')} />
    </main>
  );
}
