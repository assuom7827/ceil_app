import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireActor } from '@/lib/auth/session';
import { canWrite } from '@/services/rbac';
import { ReferencesClient } from './references-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('references.title') };
}

export default async function ReferencesPage() {
  const actor = await requireActor();
  const t = await getTranslations();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('references.title')}</h1>
        <p className="text-muted-foreground">{t('references.subtitle')}</p>
      </div>

      {/* Les droits sont calculés côté serveur ; l'API les revérifie. */}
      <ReferencesClient
        permissions={{
          faculty: canWrite(actor, 'Faculty'),
          speciality: canWrite(actor, 'Speciality'),
          teacher: canWrite(actor, 'Teacher'),
          studentCategory: canWrite(actor, 'StudentCategory'),
          trainingLevel: canWrite(actor, 'TrainingLevel'),
          diplomaModel: canWrite(actor, 'DiplomaModel'),
        }}
      />
    </main>
  );
}
