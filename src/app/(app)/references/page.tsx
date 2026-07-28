import type { Metadata } from 'next';
import { requireActor } from '@/lib/auth/session';
import { canWrite } from '@/services/rbac';
import { ReferencesClient } from './references-client';

export const metadata: Metadata = { title: 'Référentiels' };

export default async function ReferencesPage() {
  const actor = await requireActor();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Référentiels</h1>
        <p className="text-muted-foreground">Données de base partagées par toutes les sessions.</p>
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
