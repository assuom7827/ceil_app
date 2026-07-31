'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResourceForm, toFieldErrors } from '@/components/crud/resource-form';
import { ApiError, apiPost } from '@/lib/api/client';
import { sessionFormFields } from './session-fields';

/**
 * Création d'une session, puis ouverture directe de son espace de travail :
 * créer une session n'a d'intérêt que pour y travailler ensuite.
 */
export function NewSessionButton({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  if (!canWrite) return null;

  async function submit(payload: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const created = await apiPost<{ id: string }>('/api/sessions', payload);
      setOpen(false);
      router.push(`/sessions/${created.id}/workspace`);
    } catch (caught) {
      setFieldErrors(toFieldErrors(caught));
      setError(caught instanceof ApiError ? caught.message : 'Création impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Nouvelle session
      </Button>

      <ResourceForm
        open={open}
        onOpenChange={setOpen}
        title="Nouvelle session de formation"
        description="Le titre est dérivé de la formation, du niveau et de l’année — il ne se saisit pas."
        record={null}
        submitting={submitting}
        error={error}
        fieldErrors={fieldErrors}
        onSubmit={submit}
        fields={sessionFormFields}
      />
    </>
  );
}
