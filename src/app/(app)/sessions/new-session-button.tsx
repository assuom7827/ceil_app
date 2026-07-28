'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResourceForm, toFieldErrors } from '@/components/crud/resource-form';
import type { ResourceRecord } from '@/components/crud/fields';
import { ApiError, apiPost } from '@/lib/api/client';

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
        fields={[
          {
            kind: 'reference',
            name: 'trainingId',
            label: 'Formation',
            required: true,
            endpoint: '/api/trainings',
            optionLabel: (item: ResourceRecord) => String(item['frName'] ?? ''),
          },
          {
            kind: 'reference',
            name: 'trainingLevelId',
            label: 'Niveau visé',
            endpoint: '/api/training-levels',
            optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
            help: 'Laisser vide pour une session multi-niveaux : chaque groupe portera alors son propre niveau.',
          },
          {
            kind: 'text',
            name: 'academicYear',
            label: 'Année universitaire',
            placeholder: '2025-2026',
          },
          { kind: 'text', name: 'code', label: 'Code' },
          { kind: 'date', name: 'dateFrom', label: 'Début' },
          { kind: 'date', name: 'dateTo', label: 'Fin' },
          {
            kind: 'number',
            name: 'admissionThreshold',
            label: 'Seuil d’admission',
            help: 'Somme des 4 compétences à atteindre. 50 par défaut.',
          },
          {
            kind: 'text',
            name: 'matriculePrefix',
            label: 'Préfixe des matricules',
            placeholder: 'CEIL-ANG-2526',
            help: 'Les inscriptions seront numérotées « préfixe-0001 », uniques dans cette session.',
          },
          {
            kind: 'reference',
            name: 'diplomaModelId',
            label: 'Modèle de diplôme',
            endpoint: '/api/diploma-models',
            optionLabel: (item: ResourceRecord) => String(item['name'] ?? ''),
          },
        ]}
      />
    </>
  );
}
