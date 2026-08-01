'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ResourceForm, toFieldErrors } from '@/components/crud/resource-form';
import { ApiError, apiPost } from '@/lib/api/client';
import { sessionFormFields } from './session-fields';

/**
 * Création d'une session, puis ouverture directe de son espace de travail :
 * créer une session n'a d'intérêt que pour y travailler ensuite.
 */
export function NewSessionButton({ canWrite }: { canWrite: boolean }) {
  const t = useTranslations();
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
      setError(caught instanceof ApiError ? caught.message : t('common.creationImpossible'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {t('sessions.newButton')}
      </Button>

      <ResourceForm
        open={open}
        onOpenChange={setOpen}
        title={t('sessions.newTitle')}
        description={t('sessions.newDescription')}
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
